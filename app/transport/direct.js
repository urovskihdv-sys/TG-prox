import net from "node:net";

export function createDirectTransport({ logger }) {
  return {
    mode: "direct",
    async connect({ host, port, timeoutMs, requestId }) {
      logger.info("Opening direct outbound connection", {
        requestId,
        targetHost: host,
        targetPort: port
      });

      return await connectSocket({ host, port, timeoutMs });
    }
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
      const error = new Error(`connect timeout after ${timeoutMs}ms`);
      error.code = "ETIMEDOUT";
      socket.once("error", () => {});
      finalize(reject, error);
      socket.destroy(error);
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
    socket.setTimeout(timeoutMs);
  });
}
