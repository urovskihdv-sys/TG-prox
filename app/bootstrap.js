import fs from "node:fs/promises";
import { buildAppConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { applyRuntimeConfigOverrides } from "./model.js";
import { createRemoteConfigLoader } from "./remote-config.js";
import { createLocalSocks5Server } from "./socks5-server.js";
import { createDirectTransport } from "./transport/direct.js";
import { createRelayTransport } from "./transport/relay.js";

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
  const effectiveConfig = applyRuntimeConfigOverrides(
    resolvedConfig.config,
    appConfig.runtimeOverrides
  );

  logger.info("Configuration resolved", {
    source: resolvedConfig.source,
    version: effectiveConfig.version,
    proxyEndpoint: `${effectiveConfig.proxy.listenHost}:${effectiveConfig.proxy.listenPort}`,
    telegramEndpoint: `${effectiveConfig.telegram.socksHost}:${effectiveConfig.telegram.socksPort}`,
    transportMode: effectiveConfig.transport.mode
  });

  let socksServer = null;
  if (startServer) {
    const transport =
      effectiveConfig.transport.mode === "relay"
        ? await createRelayTransport({
            logger,
            relayConfig: effectiveConfig.transport.relay
          })
        : createDirectTransport({ logger });
    socksServer = createLocalSocks5Server({
      listenHost: effectiveConfig.proxy.listenHost,
      listenPort: effectiveConfig.proxy.listenPort,
      handshakeTimeoutMs: effectiveConfig.proxy.handshakeTimeoutMs,
      connectTimeoutMs: effectiveConfig.transport.connectTimeoutMs,
      logger,
      transport
    });

    await socksServer.start();
  }

  return {
    appConfig,
    logger,
    remoteConfig: {
      ...resolvedConfig,
      config: effectiveConfig
    },
    socksServer,
    async stop() {
      if (socksServer) {
        await socksServer.stop();
      }
    }
  };
}
