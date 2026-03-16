#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { createLogger } from "../app/logger.js";

export async function createRelayServer({
  listenHost,
  listenPort,
  tlsKeyPath,
  tlsCertPath,
  sharedToken,
  publicRelayURL = null,
  outboundConnectTimeoutMs = 10000,
  logger
}) {
  const [key, cert] = await Promise.all([
    fs.readFile(tlsKeyPath, "utf8"),
    fs.readFile(tlsCertPath, "utf8")
  ]);

  const server = https.createServer({ key, cert }, (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"status":"ok"}');
      return;
    }

    if (request.method === "GET" && request.url === "/config.json") {
      const configBody = JSON.stringify(
        buildClientRemoteConfig({
          request,
          sharedToken,
          publicRelayURL
        }),
        null,
        2
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end(`${configBody}\n`);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end('{"error":"not_found"}');
  });

  server.on("connect", (request, clientSocket, head) => {
    handleTunnel({
      request,
      clientSocket,
      head,
      sharedToken,
      outboundConnectTimeoutMs,
      logger
    }).catch((error) => {
      logger.warn("Relay CONNECT failed", {
        requestId: request.headers["x-tgprox-request-id"] || "unknown",
        error: error.message
      });

      if (!clientSocket.destroyed) {
        clientSocket.destroy();
      }
    });
  });

  return {
    async start() {
      await listen(server, listenHost, listenPort);
      const address = server.address();
      logger.info("Relay server listening", {
        listenHost,
        listenPort,
        boundAddress: typeof address === "string" ? address : `${address.address}:${address.port}`
      });
      return address;
    },
    async stop() {
      await closeServer(server);
      logger.info("Relay server stopped", {
        listenHost,
        listenPort
      });
    },
    address() {
      return server.address();
    }
  };
}

async function handleTunnel({
  request,
  clientSocket,
  head,
  sharedToken,
  outboundConnectTimeoutMs,
  logger
}) {
  const requestId = request.headers["x-tgprox-request-id"] || "unknown";
  if (!isAuthorized(request.headers.authorization, sharedToken)) {
    clientSocket.end("HTTP/1.1 407 Proxy Authentication Required\r\nConnection: close\r\n\r\n");
    logger.warn("Relay CONNECT rejected", {
      requestId,
      reason: "unauthorized"
    });
    return;
  }

  let target;
  try {
    target = parseConnectAuthority(request.url || "");
  } catch (error) {
    clientSocket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    throw error;
  }

  logger.info("Relay CONNECT requested", {
    requestId,
    targetHost: target.host,
    targetPort: target.port
  });

  let outboundSocket;
  try {
    outboundSocket = await connectSocket({
      host: target.host,
      port: target.port,
      timeoutMs: outboundConnectTimeoutMs
    });
  } catch (error) {
    clientSocket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    throw error;
  }

  clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
  if (head?.length) {
    outboundSocket.write(head);
  }

  clientSocket.once("error", () => outboundSocket.destroy());
  outboundSocket.once("error", () => clientSocket.destroy());
  clientSocket.once("close", () => outboundSocket.destroy());
  outboundSocket.once("close", () => clientSocket.destroy());

  clientSocket.pipe(outboundSocket);
  outboundSocket.pipe(clientSocket);
}

function isAuthorized(authorizationHeader, sharedToken) {
  return authorizationHeader === `Bearer ${sharedToken}`;
}

function parseConnectAuthority(authority) {
  let parsedURL;
  try {
    parsedURL = new URL(`http://${authority}`);
  } catch (error) {
    throw new Error(`invalid CONNECT target authority: ${error.message}`);
  }

  const port = Number(parsedURL.port || "0");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("CONNECT target port must be between 1 and 65535");
  }

  return {
    host: parsedURL.hostname,
    port
  };
}

function connectSocket({ host, port, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finalize = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
      socket.removeListener("timeout", onTimeout);
      callback(value);
    };

    const onConnect = () => {
      socket.setTimeout(0);
      finalize(resolve, socket);
    };

    const onError = (error) => {
      finalize(reject, error);
    };

    const onTimeout = () => {
      const error = new Error(`relay outbound timeout after ${timeoutMs}ms`);
      error.code = "ETIMEDOUT";
      socket.destroy(error);
      finalize(reject, error);
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
    socket.setTimeout(timeoutMs);
  });
}

function buildClientRemoteConfig({ request, sharedToken, publicRelayURL }) {
  return {
    schemaVersion: 1,
    version: "relay-live",
    updatedAt: new Date().toISOString(),
    proxy: {
      listenHost: "127.0.0.1",
      listenPort: 9150,
      handshakeTimeoutMs: 10000
    },
    telegram: {
      socksHost: "127.0.0.1",
      socksPort: 9150
    },
    transport: {
      mode: "relay",
      connectTimeoutMs: 10000,
      relay: {
        serverURL: publicRelayURL || derivePublicRelayURL(request),
        authToken: sharedToken,
        caCertPath: null
      }
    },
    controlPlane: {
      refreshIntervalMs: 300000
    }
  };
}

function derivePublicRelayURL(request) {
  const host = request.headers.host;
  if (!host) {
    throw new Error("cannot derive public relay URL without Host header");
  }

  return `https://${host}`;
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function buildServerConfig(env = process.env) {
  return {
    listenHost: env.TGPROX_RELAY_LISTEN_HOST || "0.0.0.0",
    listenPort: Number.parseInt(env.TGPROX_RELAY_LISTEN_PORT || "8443", 10),
    tlsKeyPath: env.TGPROX_RELAY_TLS_KEY_PATH || "",
    tlsCertPath: env.TGPROX_RELAY_TLS_CERT_PATH || "",
    sharedToken: env.TGPROX_RELAY_SHARED_TOKEN || "",
    publicRelayURL: env.TGPROX_RELAY_PUBLIC_URL || "",
    outboundConnectTimeoutMs: Number.parseInt(
      env.TGPROX_RELAY_CONNECT_TIMEOUT_MS || "10000",
      10
    )
  };
}

function createRelayServerLogger(env = process.env) {
  const logFilePath =
    env.TGPROX_RELAY_LOG_FILE ||
    path.join(process.cwd(), "runtime", "relay", "logs", "tg-prox-relay.log");

  return createLogger({
    appName: "TG-prox-relay",
    logFilePath
  });
}

function ensureRequiredConfig(config) {
  if (!config.tlsKeyPath) {
    throw new Error("TGPROX_RELAY_TLS_KEY_PATH is required");
  }

  if (!config.tlsCertPath) {
    throw new Error("TGPROX_RELAY_TLS_CERT_PATH is required");
  }

  if (!config.sharedToken) {
    throw new Error("TGPROX_RELAY_SHARED_TOKEN is required");
  }
}

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isMainModule) {
  const config = buildServerConfig(process.env);
  const logger = createRelayServerLogger(process.env);

  try {
    ensureRequiredConfig(config);
    const relayServer = await createRelayServer({
      ...config,
      logger
    });

    await relayServer.start();

    const stopAndExit = async (signal) => {
      await relayServer.stop();
      process.stdout.write(`TG-prox relay received ${signal}, shutdown complete\n`);
      process.exit(0);
    };

    process.once("SIGINT", () => {
      void stopAndExit("SIGINT");
    });

    process.once("SIGTERM", () => {
      void stopAndExit("SIGTERM");
    });

    await new Promise(() => {});
  } catch (error) {
    process.stderr.write(`TG-prox relay failed to start: ${error.message}\n`);
    process.exitCode = 1;
  }
}
