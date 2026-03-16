#!/usr/bin/env node
import { runApp } from "./bootstrap.js";
import { isTcpEndpointListening } from "./runtime.js";
import { buildTelegramSocksURL, launchTelegramConnect } from "./telegram-connect.js";

try {
  const command = process.argv[2] || "serve";

  if (command === "connect-url") {
    const result = await runApp({ startServer: false });
    process.stdout.write(`${buildTelegramSocksURL(result.remoteConfig.config.telegram)}\n`);
  } else if (command === "connect") {
    const connectSession = await runConnectMode();
    announceReady(connectSession.result);

    const connectURL = buildTelegramSocksURL(connectSession.result.remoteConfig.config.telegram);
    const launchResult = await launchTelegramConnect({
      connectURL,
      logger: connectSession.result.logger
    });

    if (!launchResult.opened) {
      process.stdout.write(`Telegram connect URL: ${connectURL}\n`);
    }

    if (!connectSession.keepProcessAlive) {
      await connectSession.result.stop();
      process.exit(0);
    }

    await waitForSignals(connectSession.result);
  } else if (command === "serve") {
    const result = await runApp();
    announceReady(result);
    await waitForSignals(result);
  } else {
    process.stderr.write("Usage: node app/cli.js [serve|connect|connect-url]\n");
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`TG-prox failed to start: ${error.message}\n`);
  process.exitCode = 1;
}

async function runConnectMode() {
  const probe = await runApp({ startServer: false });
  const proxyConfig = probe.remoteConfig.config.proxy;
  const existingServer = await isTcpEndpointListening({
    host: proxyConfig.listenHost,
    port: proxyConfig.listenPort
  });

  if (existingServer) {
    probe.logger.info("Reusing existing local SOCKS5 adapter", {
      proxyEndpoint: `${proxyConfig.listenHost}:${proxyConfig.listenPort}`
    });
    return {
      result: probe,
      keepProcessAlive: false
    };
  }

  await probe.stop();
  return {
    result: await runApp(),
    keepProcessAlive: true
  };
}

function announceReady(result) {
  process.stdout.write(
    `TG-prox agent ready (${result.remoteConfig.source}) on ${result.remoteConfig.config.proxy.listenHost}:${result.remoteConfig.config.proxy.listenPort}\n`
  );
}

async function waitForSignals(result) {
  const stopAndExit = async (signal) => {
    await result.stop();
    process.stdout.write(`TG-prox received ${signal}, shutdown complete\n`);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void stopAndExit("SIGINT");
  });

  process.once("SIGTERM", () => {
    void stopAndExit("SIGTERM");
  });

  await new Promise(() => {});
}
