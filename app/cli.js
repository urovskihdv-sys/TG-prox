#!/usr/bin/env node
import { runApp } from "./bootstrap.js";

try {
  const result = await runApp();
  process.stdout.write(
    `TG-prox agent ready (${result.remoteConfig.source}) on ${result.remoteConfig.config.proxy.listenHost}:${result.remoteConfig.config.proxy.listenPort}\n`
  );

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
} catch (error) {
  process.stderr.write(`TG-prox failed to start: ${error.message}\n`);
  process.exitCode = 1;
}
