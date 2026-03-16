import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import { createLocalSocks5Server } from "./socks5-server.js";
import { createDirectTransport } from "./transport/direct.js";

test("SOCKS5 server relays CONNECT traffic to target endpoint", async () => {
  const echoServer = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      socket.write(chunk);
    });
  });
  await listen(echoServer, "127.0.0.1", 0);

  const socksServer = createLocalSocks5Server({
    listenHost: "127.0.0.1",
    listenPort: 0,
    handshakeTimeoutMs: 1000,
    connectTimeoutMs: 1000,
    logger: createSilentLogger(),
    transport: createDirectTransport({
      logger: createSilentLogger()
    })
  });

  await socksServer.start();

  const proxyAddress = socksServer.address();
  const targetPort = echoServer.address().port;
  const client = net.createConnection({
    host: proxyAddress.address,
    port: proxyAddress.port
  });

  await once(client, "connect");

  client.write(Buffer.from([0x05, 0x01, 0x00]));
  const authReply = await readBytes(client, 2);
  assert.deepEqual([...authReply], [0x05, 0x00]);

  const connectRequest = Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, 0x01]),
    Buffer.from([127, 0, 0, 1]),
    bufferFromPort(targetPort)
  ]);
  client.write(connectRequest);

  const connectReply = await readBytes(client, 10);
  assert.equal(connectReply[1], 0x00);

  client.write(Buffer.from("ping"));
  const echoed = await readBytes(client, 4);
  assert.equal(echoed.toString("utf8"), "ping");

  client.destroy();
  await socksServer.stop();
  await closeServer(echoServer);
});

test("SOCKS5 server rejects unsupported commands", async () => {
  const socksServer = createLocalSocks5Server({
    listenHost: "127.0.0.1",
    listenPort: 0,
    handshakeTimeoutMs: 1000,
    connectTimeoutMs: 1000,
    logger: createSilentLogger(),
    transport: createDirectTransport({
      logger: createSilentLogger()
    })
  });

  await socksServer.start();

  const proxyAddress = socksServer.address();
  const client = net.createConnection({
    host: proxyAddress.address,
    port: proxyAddress.port
  });

  await once(client, "connect");
  client.write(Buffer.from([0x05, 0x01, 0x00]));
  await readBytes(client, 2);

  const bindRequest = Buffer.concat([
    Buffer.from([0x05, 0x02, 0x00, 0x01]),
    Buffer.from([127, 0, 0, 1]),
    bufferFromPort(443)
  ]);
  client.write(bindRequest);

  const bindReply = await readBytes(client, 10);
  assert.equal(bindReply[1], 0x07);

  client.destroy();
  await socksServer.stop();
});

test("SOCKS5 server fails to start on an occupied port", async () => {
  const occupiedServer = net.createServer();
  await listen(occupiedServer, "127.0.0.1", 0);
  const occupiedPort = occupiedServer.address().port;

  const socksServer = createLocalSocks5Server({
    listenHost: "127.0.0.1",
    listenPort: occupiedPort,
    handshakeTimeoutMs: 1000,
    connectTimeoutMs: 1000,
    logger: createSilentLogger(),
    transport: createDirectTransport({
      logger: createSilentLogger()
    })
  });

  await assert.rejects(() => socksServer.start(), /EADDRINUSE/);
  await closeServer(occupiedServer);
});

function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
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
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function bufferFromPort(port) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(port, 0);
  return buffer;
}

function readBytes(socket, size) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);

    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length >= size) {
        cleanup();
        if (buffer.length > size) {
          socket.unshift(buffer.subarray(size));
        }
        resolve(buffer.subarray(0, size));
      }
    };

    const onClose = () => {
      cleanup();
      reject(new Error("socket closed before enough bytes were read"));
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("close", onClose);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}
