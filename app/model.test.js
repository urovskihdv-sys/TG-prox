import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRuntimeConfigOverrides,
  ConfigValidationError,
  normalizeRemoteConfig,
  normalizeRemoteConfigURL,
  resolveRuntimeConfigOverrides
} from "./model.js";

test("normalizeRemoteConfig fills defaults for missing optional fields", () => {
  const normalized = normalizeRemoteConfig({
    version: "remote-v1"
  });

  assert.equal(normalized.version, "remote-v1");
  assert.equal(normalized.proxy.listenHost, "127.0.0.1");
  assert.equal(normalized.proxy.listenPort, 9150);
  assert.equal(normalized.telegram.socksPort, 9150);
  assert.equal(normalized.controlPlane.refreshIntervalMs, 300000);
});

test("normalizeRemoteConfig rejects invalid ports", () => {
  assert.throws(
    () =>
      normalizeRemoteConfig({
        proxy: {
          listenPort: 70000
        }
      }),
    ConfigValidationError
  );
});

test("normalizeRemoteConfigURL requires HTTPS outside localhost", () => {
  assert.throws(
    () => normalizeRemoteConfigURL("http://control.example.com/config.json"),
    ConfigValidationError
  );

  const parsed = normalizeRemoteConfigURL("https://control.example.com/config.json");
  assert.equal(parsed.origin, "https://control.example.com");
});

test("normalizeRemoteConfig accepts relay transport configuration", () => {
  const normalized = normalizeRemoteConfig({
    transport: {
      mode: "relay",
      relay: {
        serverURL: "https://relay.example.com:8443/path-ignored",
        authToken: "secret-token"
      }
    }
  });

  assert.equal(normalized.transport.mode, "relay");
  assert.equal(normalized.transport.relay.serverURL, "https://relay.example.com:8443");
  assert.equal(normalized.transport.relay.authToken, "secret-token");
});

test("normalizeRemoteConfig rejects relay mode without serverURL", () => {
  assert.throws(
    () =>
      normalizeRemoteConfig({
        transport: {
          mode: "relay",
          relay: {
            authToken: "secret-token"
          }
        }
      }),
    ConfigValidationError
  );
});

test("resolveRuntimeConfigOverrides reads relay env overrides", () => {
  const overrides = resolveRuntimeConfigOverrides({
    TGPROX_TRANSPORT_MODE: "relay",
    TGPROX_RELAY_URL: "https://relay.example.com:9443",
    TGPROX_RELAY_AUTH_TOKEN: "token-123",
    TGPROX_RELAY_CA_CERT_PATH: "/tmp/relay-ca.pem"
  });

  assert.deepEqual(overrides, {
    transportMode: "relay",
    relayServerURL: "https://relay.example.com:9443",
    relayAuthToken: "token-123",
    relayCACertPath: "/tmp/relay-ca.pem"
  });
});

test("applyRuntimeConfigOverrides switches direct config to relay", () => {
  const effectiveConfig = applyRuntimeConfigOverrides(
    normalizeRemoteConfig({
      transport: {
        mode: "direct"
      }
    }),
    {
      transportMode: "relay",
      relayServerURL: "https://relay.example.com:8443",
      relayAuthToken: "token-123",
      relayCACertPath: "/tmp/relay-ca.pem"
    }
  );

  assert.equal(effectiveConfig.transport.mode, "relay");
  assert.equal(effectiveConfig.transport.relay.serverURL, "https://relay.example.com:8443");
  assert.equal(effectiveConfig.transport.relay.authToken, "token-123");
  assert.equal(effectiveConfig.transport.relay.caCertPath, "/tmp/relay-ca.pem");
});
