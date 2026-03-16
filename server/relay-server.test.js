import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createRelayTransport } from "../app/transport/relay.js";
import { createRelayServer } from "./relay-server.js";

test("relay transport tunnels traffic through the relay server", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-prox-relay-"));
  const tlsKeyPath = path.join(tempDir, "relay.key");
  const tlsCertPath = path.join(tempDir, "relay.crt");
  await fs.writeFile(tlsKeyPath, TEST_TLS_KEY, "utf8");
  await fs.writeFile(tlsCertPath, TEST_TLS_CERT, "utf8");

  const echoServer = net.createServer((socket) => {
    socket.on("data", (chunk) => {
      socket.write(chunk);
    });
  });
  await listen(echoServer, "127.0.0.1", 0);

  const relayServer = await createRelayServer({
    listenHost: "localhost",
    listenPort: 0,
    tlsKeyPath,
    tlsCertPath,
    sharedToken: "relay-secret",
    logger: createSilentLogger()
  });
  await relayServer.start();

  const relayAddress = relayServer.address();
  const relayTransport = await createRelayTransport({
    logger: createSilentLogger(),
    relayConfig: {
      serverURL: `https://localhost:${relayAddress.port}`,
      authToken: "relay-secret",
      caCertPath: tlsCertPath
    }
  });

  const outboundSocket = await relayTransport.connect({
    host: "127.0.0.1",
    port: echoServer.address().port,
    timeoutMs: 1000,
    requestId: "relay-test-request"
  });

  outboundSocket.write(Buffer.from("ping"));
  const echoed = await readBytes(outboundSocket, 4);

  assert.equal(echoed.toString("utf8"), "ping");

  outboundSocket.destroy();
  await relayServer.stop();
  await closeServer(echoServer);
});

test("relay transport rejects unauthorized connections", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-prox-relay-"));
  const tlsKeyPath = path.join(tempDir, "relay.key");
  const tlsCertPath = path.join(tempDir, "relay.crt");
  await fs.writeFile(tlsKeyPath, TEST_TLS_KEY, "utf8");
  await fs.writeFile(tlsCertPath, TEST_TLS_CERT, "utf8");

  const relayServer = await createRelayServer({
    listenHost: "localhost",
    listenPort: 0,
    tlsKeyPath,
    tlsCertPath,
    sharedToken: "relay-secret",
    logger: createSilentLogger()
  });
  await relayServer.start();

  const relayAddress = relayServer.address();
  const relayTransport = await createRelayTransport({
    logger: createSilentLogger(),
    relayConfig: {
      serverURL: `https://localhost:${relayAddress.port}`,
      authToken: "wrong-token",
      caCertPath: tlsCertPath
    }
  });

  await assert.rejects(
    () =>
      relayTransport.connect({
        host: "127.0.0.1",
        port: 443,
        timeoutMs: 1000,
        requestId: "relay-test-unauthorized"
      }),
    /407/
  );

  await relayServer.stop();
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

const TEST_TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCzmhmfgy5r1zgz
hDumiZCi8LrGXAu7DBHWLrJ28YRVOa0xYjy7gTy6Tn8sU7iwuAFMc1T3U+J7Kml5
tGyE3BmZs19d4dOoy5bWF9nE6SlCqbxMxu+U3/Ddbq/Sfy3s6ze8vCnGJupBFFqW
ajvFQpry/H3VW1s4yS9hlugp7qUJNweUSDkJV8XH23IaH6a6vydzBwPwD+4/YAAK
IrULz0wBd+1RirhvKY5lavVIUCEy4rKKoqHulW4zaTR38gSC3dC1Hp8g9U6iEK+Q
F0DcurAUWzt/54wj7E2QybuQYBPRYxKxztjvKG6a69U8kqqH1DbkLzwaBetKM2Xz
kp1cwHmnAgMBAAECggEAC0Y3KY5AkcB25LT+UZv9Gl1mPCF3EwzU6c8QoOrUVc1D
FACIs3SPbVqUHSI8S8uhOT1cLhJz+ytUZ7FtxoFSkhVyfSA5+zSciWAB6ZyBXI/v
JBqw23WbVyslml8lcOPrIcvmC2xR9Dfk3+BXVDC0LWCwPX54oX3vnX6toEQ80/En
eLGFwtQlxqwY0INsO+F0UwxqBTLKQKe5fwW0qdXwYlFfGPQ6Aw9Of9tX7UwVeAQC
NZ/tYsbLxGBNSerU2RScGgdL0KTQ3Yp+bzJ22IabStEcGusRMEb7vME6A7OuJPGz
ks9g6V8TH4WjsSdXgdp6/LoJWoxPeVnon/d/dislQQKBgQDb6MfSCqp85jJdGE0Y
dHcEy0LV/D36ILcs+/PmvGW2xp7zzM0GDW+3Dqb8avcSDz9LLL5oS0s76QQeY2kx
LQGNxs60RpYCo09l9wDdVYPDeZuoaSdvI8mSyXbAsaYURF8US5sTaabv/ddiXZvC
1DJIT9kAcnm6eb3sEPdmQTjucQKBgQDRE9sZsAc6BUMP/bNlX3DRmubV3R6GwpDL
qouq3p7Vzhc808+O1SLoMTDB8OLnzkvGWOelnoye3X5+2yd0oc9+YThH8pnx3m/l
jpPVtuoGB17xDJjHisQFF+jl53UPkQH4ZMYlTcBv5BhbDRJ+F1H7EvdlD5x+Huca
b/o1Ys2llwKBgGqUqHvpRXXhT5mFFKB8mc6OAOebKCKZRo4b0rsKpjVukE1S/i8n
xfQvusjtwq9TCncRyXrcuyrfJWrg/XOi/3TKXRZMe5ntsqaVjyq2rnTH9KQryrv3
2VM2J0L/FqIN/RLmDdPbydfY7FG1Uq+bjn8zi9XGpa62IFFQa8d4ZvJRAoGACKRu
eRhapB5VkFKnWLhiPHfPtOVn/qAKRjDthwmevS3AriX/PWM4BysJXersJjLT1QYV
xTXRkDuNoAbFEcAiiJHSNr8jd+j+7RlAqSPfdpJVbVdc9VqaEa/UU7SGlTckQrU/
r4kQPE/MZe8bZZTnMZ6uFUJY8KmsWd5pFE3aPE8CgYB3+z9ZQoVzlmjK3TScsInq
sd7EqZiXfCMPve6OlP9oAW2Rv2I7Autc4G70ICVCb/qI0vsDQsGJuTIyoObZci5m
XtiEvNVXXo0oyakCst5t45YP73CK0ofA2a8fIndbPHqx0B7zmGPA0f8ospcgynzu
aBiJL6WVrjTTjeT6LaTtiQ==
-----END PRIVATE KEY-----
`;

const TEST_TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUJ1/QdFub6hpJ/WiEwPyn1rwP/DkwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDMxNjE4NTAwNFoXDTI3MDMx
NjE4NTAwNFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAs5oZn4Mua9c4M4Q7pomQovC6xlwLuwwR1i6ydvGEVTmt
MWI8u4E8uk5/LFO4sLgBTHNU91PieyppebRshNwZmbNfXeHTqMuW1hfZxOkpQqm8
TMbvlN/w3W6v0n8t7Os3vLwpxibqQRRalmo7xUKa8vx91VtbOMkvYZboKe6lCTcH
lEg5CVfFx9tyGh+mur8ncwcD8A/uP2AACiK1C89MAXftUYq4bymOZWr1SFAhMuKy
iqKh7pVuM2k0d/IEgt3QtR6fIPVOohCvkBdA3LqwFFs7f+eMI+xNkMm7kGAT0WMS
sc7Y7yhumuvVPJKqh9Q25C88GgXrSjNl85KdXMB5pwIDAQABo1MwUTAdBgNVHQ4E
FgQUd2D/MjbVvcF16OQAC0ahu04YOoUwHwYDVR0jBBgwFoAUd2D/MjbVvcF16OQA
C0ahu04YOoUwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAYA0Y
FA+bW1cedRBp717SQsgX8FpiZa5PtzNw2n3QRdzCuawPW1OthbfAA6y+rG0FJS8o
YoJUTPpWrphiGAuLkh+mf+oIh5T7kCmSJDWmHWq7islUMK3WGLmkVVOGgn0i7n5O
lXilcWN1QW3uiLniga2t0UDEkmwBtzH1KKGjKSGjS2gRXve+fsk9HpdonyM+6AWQ
UpZbSUEGLK4I0fcxLL9ODhlnsoXeld1IgxC5ZTtyOZRQpP3F4DmW0TpWqqNqdx3T
+C9NccA+ejH5vK1rbtGDblVKJ7w9LeseyP1CixCn5jo1MOaTHj9hVsJkaAFUNEbf
IazvLIjkrfO/JrqeRw==
-----END CERTIFICATE-----
`;
