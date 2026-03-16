import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { isTcpEndpointListening } from "./runtime.js";

test("isTcpEndpointListening returns true for a listening loopback endpoint", async () => {
  const server = net.createServer();
  await listen(server, "127.0.0.1", 0);

  const address = server.address();
  const reachable = await isTcpEndpointListening({
    host: "127.0.0.1",
    port: address.port
  });

  assert.equal(reachable, true);
  await closeServer(server);
});

test("isTcpEndpointListening returns false when nothing is listening", async () => {
  const server = net.createServer();
  await listen(server, "127.0.0.1", 0);

  const address = server.address();
  await closeServer(server);

  const reachable = await isTcpEndpointListening({
    host: "127.0.0.1",
    port: address.port
  });

  assert.equal(reachable, false);
});

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
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
