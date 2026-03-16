#!/usr/bin/env node
import { runApp } from "./bootstrap.js";

try {
  const result = await runApp();
  process.stdout.write(
    `TG-prox bootstrap ready (${result.remoteConfig.source}) on ${result.remoteConfig.config.proxy.listenHost}:${result.remoteConfig.config.proxy.listenPort}\n`
  );
} catch (error) {
  process.stderr.write(`TG-prox failed to start: ${error.message}\n`);
  process.exitCode = 1;
}
