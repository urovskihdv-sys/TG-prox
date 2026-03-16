#!/usr/bin/env node
import { runApp } from "./bootstrap.js";
import { buildTelegramSocksURL, launchTelegramConnect } from "./telegram-connect.js";

try {
  const command = process.argv[2] || "serve";

  if (command === "connect-url") {
    const result = await runApp({ startServer: false });
    process.stdout.write(`${buildTelegramSocksURL(result.remoteConfig.config.telegram)}\n`);
  } else if (command === "connect") {
    const result = await runApp();
    announceReady(result);

    const connectURL = buildTelegramSocksURL(result.remoteConfig.config.telegram);
    const launchResult = await launchTelegramConnect({
      connectURL,
      logger: result.logger
    });

    if (!launchResult.opened) {
      process.stdout.write(`Telegram connect URL: ${connectURL}\n`);
    }

    await waitForSignals(result);
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
