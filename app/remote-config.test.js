import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createRemoteConfigLoader } from "./remote-config.js";

test("remote config loader prefers remote and writes cache", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-prox-"));
  const defaultConfigPath = path.join(tempDir, "default.remote-config.json");
  const cacheFilePath = path.join(tempDir, "cache", "remote-config.json");

  await writeJSON(defaultConfigPath, {
    version: "default-v1"
  });

  const loader = createRemoteConfigLoader({
    defaultConfigPath,
    cacheFilePath,
    remoteConfigURL: new URL("https://control.example.com/config.json"),
    timeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          version: "remote-v2",
          proxy: {
            listenPort: 9151
          }
        };
      }
    }),
    logger: createSilentLogger()
  });

  const resolved = await loader.load();
  const cached = JSON.parse(await fs.readFile(cacheFilePath, "utf8"));

  assert.equal(resolved.source, "remote");
  assert.equal(resolved.config.version, "remote-v2");
  assert.equal(cached.config.version, "remote-v2");
});

test("remote config loader falls back to cache when fetch fails", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-prox-"));
  const defaultConfigPath = path.join(tempDir, "default.remote-config.json");
  const cacheFilePath = path.join(tempDir, "cache", "remote-config.json");

  await writeJSON(defaultConfigPath, {
    version: "default-v1"
  });

  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
  await writeJSON(cacheFilePath, {
    cachedAt: "2026-03-16T00:00:00.000Z",
    config: {
      version: "cached-v2",
      proxy: {
        listenPort: 9152
      }
    }
  });

  const loader = createRemoteConfigLoader({
    defaultConfigPath,
    cacheFilePath,
    remoteConfigURL: new URL("https://control.example.com/config.json"),
    timeoutMs: 1000,
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    logger: createSilentLogger()
  });

  const resolved = await loader.load();

  assert.equal(resolved.source, "cache");
  assert.equal(resolved.config.version, "cached-v2");
  assert.equal(resolved.config.proxy.listenPort, 9152);
});

test("remote config loader falls back to bundled defaults when cache is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-prox-"));
  const defaultConfigPath = path.join(tempDir, "default.remote-config.json");
  const cacheFilePath = path.join(tempDir, "cache", "remote-config.json");

  await writeJSON(defaultConfigPath, {
    version: "default-v1"
  });

  const loader = createRemoteConfigLoader({
    defaultConfigPath,
    cacheFilePath,
    remoteConfigURL: new URL("https://control.example.com/config.json"),
    timeoutMs: 1000,
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    logger: createSilentLogger()
  });

  const resolved = await loader.load();

  assert.equal(resolved.source, "default");
  assert.equal(resolved.config.version, "default-v1");
  assert.equal(resolved.config.proxy.listenPort, 9150);
});

function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

async function writeJSON(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
