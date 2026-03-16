import net from "node:net";

export async function isTcpEndpointListening({ host, port, timeoutMs = 250 }) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({
      host,
      port
    });

    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}
