import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  buildTelegramSocksURL,
  launchTelegramConnect,
  resolveTelegramOpenInvocation
} from "./telegram-connect.js";

test("buildTelegramSocksURL encodes server and port", () => {
  const connectURL = buildTelegramSocksURL({
    socksHost: "127.0.0.1",
    socksPort: 9150
  });

  assert.equal(connectURL, "tg://socks?server=127.0.0.1&port=9150");
});

test("resolveTelegramOpenInvocation uses Windows shell launch flow", () => {
  const invocation = resolveTelegramOpenInvocation("win32", "tg://socks?server=127.0.0.1&port=9150");

  assert.deepEqual(invocation, {
    command: "cmd.exe",
    args: ["/c", "start", "", "tg://socks?server=127.0.0.1&port=9150"],
    options: {
      windowsHide: true
    }
  });
});

test("resolveTelegramOpenInvocation uses xdg-open on Linux", () => {
  const invocation = resolveTelegramOpenInvocation("linux", "tg://socks?server=127.0.0.1&port=9150");

  assert.deepEqual(invocation, {
    command: "xdg-open",
    args: ["tg://socks?server=127.0.0.1&port=9150"],
    options: {}
  });
});

test("launchTelegramConnect reports success when launcher exits cleanly", async () => {
  const launches = [];
  const result = await launchTelegramConnect({
    connectURL: "tg://socks?server=127.0.0.1&port=9150",
    logger: createSilentLogger(),
    platform: "darwin",
    spawnImpl(command, args, options) {
      launches.push({ command, args, options });

      const child = new EventEmitter();
      process.nextTick(() => {
        child.emit("exit", 0, null);
      });
      return child;
    }
  });

  assert.equal(result.opened, true);
  assert.equal(launches[0].command, "open");
});

test("launchTelegramConnect falls back to manual mode on launcher error", async () => {
  const result = await launchTelegramConnect({
    connectURL: "tg://socks?server=127.0.0.1&port=9150",
    logger: createSilentLogger(),
    platform: "linux",
    spawnImpl() {
      const child = new EventEmitter();
      process.nextTick(() => {
        child.emit("error", new Error("xdg-open missing"));
      });
      return child;
    }
  });

  assert.equal(result.opened, false);
  assert.equal(result.mode, "print");
});

function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}
