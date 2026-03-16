import fs from "node:fs/promises";
import { buildAppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRemoteConfigLoader } from "./remote-config.js";
import { createLocalSocks5Server } from "./socks5-server.js";
import { createDirectTransport } from "./transport/direct.js";

export async function runApp({
  env = process.env,
  fetchImpl = globalThis.fetch,
  startServer = true
} = {}) {
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

  let socksServer = null;
  if (startServer) {
    const transport = createDirectTransport({ logger });
    socksServer = createLocalSocks5Server({
      listenHost: resolvedConfig.config.proxy.listenHost,
      listenPort: resolvedConfig.config.proxy.listenPort,
      handshakeTimeoutMs: resolvedConfig.config.proxy.handshakeTimeoutMs,
      connectTimeoutMs: resolvedConfig.config.transport.connectTimeoutMs,
      logger,
      transport
    });

    await socksServer.start();
  }

  return {
    appConfig,
    logger,
    remoteConfig: resolvedConfig,
    socksServer,
    async stop() {
      if (socksServer) {
        await socksServer.stop();
      }
    }
  };
}
