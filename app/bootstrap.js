import fs from "node:fs/promises";
import { buildAppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRemoteConfigLoader } from "./remote-config.js";

export async function runApp({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const appConfig = buildAppConfig(env);

  await fs.mkdir(appConfig.paths.appHome, { recursive: true });
  await fs.mkdir(appConfig.paths.cacheDir, { recursive: true });
  await fs.mkdir(appConfig.paths.logDir, { recursive: true });

  const logger = createLogger({
    appName: appConfig.appName,
    logFilePath: appConfig.paths.logFilePath
  });

  logger.info("TG-prox bootstrap starting", {
    env: appConfig.env,
    platform: process.platform,
    remoteConfigEnabled: Boolean(appConfig.controlPlane.remoteConfigURL)
  });

  const loader = createRemoteConfigLoader({
    defaultConfigPath: appConfig.paths.defaultConfigPath,
    cacheFilePath: appConfig.paths.cacheFilePath,
    remoteConfigURL: appConfig.controlPlane.remoteConfigURL,
    timeoutMs: appConfig.controlPlane.timeoutMs,
    fetchImpl,
    logger
  });

  const resolvedConfig = await loader.load();

  logger.info("Configuration resolved", {
    source: resolvedConfig.source,
    version: resolvedConfig.config.version,
    proxyEndpoint: `${resolvedConfig.config.proxy.listenHost}:${resolvedConfig.config.proxy.listenPort}`,
    telegramEndpoint: `${resolvedConfig.config.telegram.socksHost}:${resolvedConfig.config.telegram.socksPort}`
  });

  return {
    appConfig,
    logger,
    remoteConfig: resolvedConfig
  };
}
