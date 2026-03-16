import fs from "node:fs/promises";
import path from "node:path";
import { ConfigValidationError, normalizeRemoteConfig } from "./model.js";

export function createRemoteConfigLoader({
  defaultConfigPath,
  cacheFilePath,
  remoteConfigURL,
  timeoutMs,
  fetchImpl = globalThis.fetch,
  logger
}) {
  return {
    async load() {
      const defaultConfig = await loadDefaultConfig(defaultConfigPath);
      const cachedConfig = await loadCachedConfig(cacheFilePath, logger);

      if (remoteConfigURL) {
        const remoteConfig = await loadRemoteConfig({
          remoteConfigURL,
          timeoutMs,
          fetchImpl,
          cacheFilePath,
          logger
        });

        if (remoteConfig) {
          return remoteConfig;
        }
      } else {
        logger.info("Remote config URL is not configured; skipping control plane fetch", {
          fallback: cachedConfig ? "cache" : "default"
        });
      }

      if (cachedConfig) {
        logger.warn("Using cached remote config", {
          source: "cache",
          version: cachedConfig.config.version
        });
        return cachedConfig;
      }

      logger.warn("Using bundled default config", {
        source: "default",
        version: defaultConfig.version
      });

      return {
        source: "default",
        config: defaultConfig,
        metadata: {
          loadedFrom: defaultConfigPath
        }
      };
    }
  };
}

async function loadDefaultConfig(defaultConfigPath) {
  const fileContents = await fs.readFile(defaultConfigPath, "utf8");
  return normalizeRemoteConfig(JSON.parse(fileContents));
}

async function loadCachedConfig(cacheFilePath, logger) {
  try {
    const rawCache = await fs.readFile(cacheFilePath, "utf8");
    const parsedCache = JSON.parse(rawCache);
    const cachedConfig = normalizeRemoteConfig(parsedCache.config || parsedCache);

    return {
      source: "cache",
      config: cachedConfig,
      metadata: {
        cacheFilePath,
        cachedAt: parsedCache.cachedAt || null
      }
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    logger.warn("Ignoring invalid cached config", {
      cacheFilePath,
      error: error.message
    });
    return null;
  }
}

async function loadRemoteConfig({ remoteConfigURL, timeoutMs, fetchImpl, cacheFilePath, logger }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is not available");
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(remoteConfigURL, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`unexpected status ${response.status}`);
    }

    const parsedBody = await response.json();
    const config = normalizeRemoteConfig(parsedBody);
    await persistCache(cacheFilePath, remoteConfigURL, config);

    logger.info("Remote config refreshed", {
      source: "remote",
      remoteOrigin: remoteConfigURL.origin,
      version: config.version
    });

    return {
      source: "remote",
      config,
      metadata: {
        cacheFilePath,
        remoteOrigin: remoteConfigURL.origin
      }
    };
  } catch (error) {
    const reason =
      error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message;

    logger.warn("Remote config fetch failed; falling back", {
      remoteOrigin: remoteConfigURL.origin,
      error: reason
    });
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function persistCache(cacheFilePath, remoteConfigURL, config) {
  await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });

  const tempFilePath = `${cacheFilePath}.tmp`;
  const cacheEnvelope = {
    cachedAt: new Date().toISOString(),
    remoteOrigin: remoteConfigURL.origin,
    config
  };

  await fs.writeFile(tempFilePath, `${JSON.stringify(cacheEnvelope, null, 2)}\n`, "utf8");
  await fs.rename(tempFilePath, cacheFilePath);
}

export { ConfigValidationError };
