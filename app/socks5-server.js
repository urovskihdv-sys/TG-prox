import crypto from "node:crypto";
import net from "node:net";

const SOCKS_VERSION = 0x05;
const AUTH_NO_AUTH = 0x00;
const AUTH_NO_ACCEPTABLE = 0xff;
const CMD_CONNECT = 0x01;
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;

export function createLocalSocks5Server({
  listenHost,
  listenPort,
  handshakeTimeoutMs,
  connectTimeoutMs,
  logger,
  transport
}) {
  const server = net.createServer((clientSocket) => {
    handleClient({
      clientSocket,
      handshakeTimeoutMs,
      connectTimeoutMs,
      logger,
      transport
    }).catch((error) => {
      logger.warn("SOCKS5 session ended with error", {
        error: error.message
      });
      clientSocket.destroy();
    });
  });

  return {
    async start() {
      await listen(server, listenHost, listenPort);

      const address = server.address();
      logger.info("Local SOCKS5 adapter listening", {
        listenHost,
        listenPort,
        boundAddress: typeof address === "string" ? address : `${address.address}:${address.port}`,
        transportMode: transport.mode
      });

      return address;
    },
    async stop() {
      await closeServer(server);
      logger.info("Local SOCKS5 adapter stopped", {
        listenHost,
        listenPort
      });
    },
    address() {
      return server.address();
    }
  };
}

async function handleClient({ clientSocket, handshakeTimeoutMs, connectTimeoutMs, logger, transport }) {
  const requestId = crypto.randomUUID();
  clientSocket.setNoDelay(true);
  clientSocket.setKeepAlive(true, 15000);
  clientSocket.setTimeout(handshakeTimeoutMs);
  let wroteReply = false;

  logger.info("SOCKS5 client connected", {
    requestId,
    clientAddress: clientSocket.remoteAddress,
    clientPort: clientSocket.remotePort
  });

  try {
    const greeting = await readFrame(clientSocket, 2);
    ensureSocksVersion(greeting[0]);

    const methodCount = greeting[1];
    const methodsBuffer = await readFrame(clientSocket, methodCount);
    if (!methodsBuffer.includes(AUTH_NO_AUTH)) {
      clientSocket.write(Buffer.from([SOCKS_VERSION, AUTH_NO_ACCEPTABLE]));
      throw new Error("client did not offer no-auth SOCKS5 method");
    }

    clientSocket.write(Buffer.from([SOCKS_VERSION, AUTH_NO_AUTH]));

    const requestHeader = await readFrame(clientSocket, 4);
    ensureSocksVersion(requestHeader[0]);

    const command = requestHeader[1];
    const atyp = requestHeader[3];
    const targetHost = await readTargetHost(clientSocket, atyp);
    const targetPort = await readTargetPort(clientSocket);

    if (command !== CMD_CONNECT) {
      await writeSocksReply(clientSocket, 0x07);
      wroteReply = true;
      throw new Error(`unsupported SOCKS5 command ${command}`);
    }

    let outboundSocket;
    try {
      outboundSocket = await transport.connect({
        host: targetHost,
        port: targetPort,
        timeoutMs: connectTimeoutMs,
        requestId
      });
    } catch (error) {
      if (!clientSocket.destroyed) {
        await writeSocksReply(clientSocket, mapOutboundErrorToReplyCode(error));
        wroteReply = true;
      }
      throw error;
    }

    outboundSocket.setNoDelay(true);
    outboundSocket.setKeepAlive(true, 15000);
    clientSocket.setTimeout(0);

    logger.info("SOCKS5 outbound connected", {
      requestId,
      targetHost,
      targetPort
    });

    await writeSocksReply(clientSocket, 0x00, outboundSocket.localAddress, outboundSocket.localPort);
    wroteReply = true;
    startRelay({
      clientSocket,
      outboundSocket,
      requestId,
      logger,
      targetHost,
      targetPort
    });
  } catch (error) {
    if (!clientSocket.destroyed && !wroteReply) {
      clientSocket.destroy();
    } else if (!clientSocket.destroyed) {
      clientSocket.end();
    }
    throw error;
  }
}

function startRelay({ clientSocket, outboundSocket, requestId, logger, targetHost, targetPort }) {
  const closeBoth = (error) => {
    if (error) {
      logger.warn("SOCKS5 relay closed with error", {
        requestId,
        targetHost,
        targetPort,
        error: error.message
      });
    } else {
      logger.info("SOCKS5 relay closed", {
        requestId,
        targetHost,
        targetPort
      });
    }

    clientSocket.destroy();
    outboundSocket.destroy();
  };

  clientSocket.once("error", closeBoth);
  outboundSocket.once("error", closeBoth);
  clientSocket.once("close", () => outboundSocket.destroy());
  outboundSocket.once("close", () => clientSocket.destroy());

  clientSocket.pipe(outboundSocket);
  outboundSocket.pipe(clientSocket);
}

async function readTargetHost(socket, atyp) {
  if (atyp === ATYP_IPV4) {
    const buffer = await readFrame(socket, 4);
    return Array.from(buffer.values()).join(".");
  }

  if (atyp === ATYP_IPV6) {
    const buffer = await readFrame(socket, 16);
    const groups = [];
    for (let index = 0; index < buffer.length; index += 2) {
      groups.push(buffer.readUInt16BE(index).toString(16));
    }
    return groups.join(":");
  }

  if (atyp === ATYP_DOMAIN) {
    const lengthBuffer = await readFrame(socket, 1);
    const domainLength = lengthBuffer[0];
    const domainBuffer = await readFrame(socket, domainLength);
    return domainBuffer.toString("utf8");
  }

  throw new Error(`unsupported address type ${atyp}`);
}

async function readTargetPort(socket) {
  const buffer = await readFrame(socket, 2);
  return buffer.readUInt16BE(0);
}

async function writeSocksReply(socket, replyCode, bindHost = "0.0.0.0", bindPort = 0) {
  const address = normalizeReplyAddress(bindHost);
  const response = Buffer.alloc(6 + address.length);

  response[0] = SOCKS_VERSION;
  response[1] = replyCode;
  response[2] = 0x00;
  response[3] = ATYP_IPV4;
  address.copy(response, 4);
  response.writeUInt16BE(bindPort, 8);

  await writeBuffer(socket, response);
}

function normalizeReplyAddress(bindHost) {
  if (net.isIPv4(bindHost)) {
    return Buffer.from(bindHost.split(".").map((part) => Number.parseInt(part, 10)));
  }

  return Buffer.from([0x00, 0x00, 0x00, 0x00]);
}

function readFrame(socket, size) {
  return new Promise((resolve, reject) => {
    if (size === 0) {
      resolve(Buffer.alloc(0));
      return;
    }

    let buffer = socket.__tgproxBuffer || Buffer.alloc(0);
    if (buffer.length >= size) {
      socket.__tgproxBuffer = buffer.subarray(size);
      resolve(buffer.subarray(0, size));
      return;
    }

    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= size) {
        cleanup();
        socket.__tgproxBuffer = buffer.subarray(size);
        resolve(buffer.subarray(0, size));
      }
    };

    const onClose = () => {
      cleanup();
      reject(new Error("socket closed while reading SOCKS5 frame"));
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("socket timed out during SOCKS5 handshake"));
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("close", onClose);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };

    socket.on("data", onData);
    socket.once("close", onClose);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

function writeBuffer(socket, buffer) {
  return new Promise((resolve, reject) => {
    socket.write(buffer, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function ensureSocksVersion(version) {
  if (version !== SOCKS_VERSION) {
    throw new Error(`unsupported SOCKS version ${version}`);
  }
}

function mapOutboundErrorToReplyCode(error) {
  if (!error || typeof error !== "object") {
    return 0x01;
  }

  if (error.code === "ETIMEDOUT") {
    return 0x06;
  }

  if (error.code === "ECONNREFUSED") {
    return 0x05;
  }

  if (error.code === "EHOSTUNREACH" || error.code === "ENETUNREACH") {
    return 0x04;
  }

  return 0x01;
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
