import fs from "node:fs/promises";
import https from "node:https";

export async function createRelayTransport({ logger, relayConfig }) {
  const relayURL = new URL(relayConfig.serverURL);
  const ca = relayConfig.caCertPath ? await fs.readFile(relayConfig.caCertPath, "utf8") : undefined;

  return {
    mode: "relay",
    async connect({ host, port, timeoutMs, requestId }) {
      logger.info("Opening relay outbound connection", {
        requestId,
        relayHost: relayURL.host,
        targetHost: host,
        targetPort: port
      });

      return await connectThroughRelay({
        relayURL,
        authToken: relayConfig.authToken,
        ca,
        targetHost: host,
        targetPort: port,
        timeoutMs,
        requestId
      });
    }
  };
}

function connectThroughRelay({
  relayURL,
  authToken,
  ca,
  targetHost,
  targetPort,
  timeoutMs,
  requestId
}) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: relayURL.protocol,
      hostname: relayURL.hostname,
      port: relayURL.port || 443,
      method: "CONNECT",
      path: `${targetHost}:${targetPort}`,
      agent: false,
      servername: relayURL.hostname,
      rejectUnauthorized: true,
      ca,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-TGProx-Request-Id": requestId,
        Host: relayURL.host
      }
    });

    let settled = false;

    const finalize = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      request.removeListener("connect", onConnect);
      request.removeListener("error", onError);
      request.removeListener("timeout", onTimeout);
      callback(value);
    };

    const onConnect = (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        finalize(reject, new Error(`relay CONNECT failed with status ${response.statusCode}`));
        return;
      }

      request.setTimeout(0);
      socket.setTimeout(0);
      socket.setNoDelay(true);
      socket.setKeepAlive(true, 15000);
      if (head?.length) {
        socket.unshift(head);
      }

      finalize(resolve, socket);
    };

    const onError = (error) => {
      finalize(reject, error);
    };

    const onTimeout = () => {
      const error = new Error(`relay CONNECT timeout after ${timeoutMs}ms`);
      error.code = "ETIMEDOUT";
      request.destroy(error);
      finalize(reject, error);
    };

    request.once("connect", onConnect);
    request.once("error", onError);
    request.once("timeout", onTimeout);
    request.setTimeout(timeoutMs);
    request.end();
  });
}
