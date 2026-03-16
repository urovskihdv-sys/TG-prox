import test from "node:test";
import assert from "node:assert/strict";
import { ConfigValidationError, normalizeRemoteConfig, normalizeRemoteConfigURL } from "./model.js";

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
