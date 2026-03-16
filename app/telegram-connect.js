import { spawn } from "node:child_process";

export function buildTelegramSocksURL(telegramConfig) {
  const params = new URLSearchParams({
    server: telegramConfig.socksHost,
    port: String(telegramConfig.socksPort)
  });

  return `tg://socks?${params.toString()}`;
}

export function resolveTelegramOpenInvocation(platform, connectURL) {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/c", "start", "", connectURL],
      options: {
        windowsHide: true
      }
    };
  }

  if (platform === "darwin") {
    return {
      command: "open",
      args: [connectURL],
      options: {}
    };
  }

  if (platform === "linux") {
    return {
      command: "xdg-open",
      args: [connectURL],
      options: {}
    };
  }

  return null;
}

export async function launchTelegramConnect({
  connectURL,
  logger,
  platform = process.platform,
  spawnImpl = spawn
}) {
  const invocation = resolveTelegramOpenInvocation(platform, connectURL);
  if (!invocation) {
    logger.warn("No Telegram launcher configured for this platform", {
      platform
    });
    return {
      opened: false,
      mode: "print"
    };
  }

  try {
    await runLauncher(invocation, spawnImpl);
    logger.info("Telegram connect action launched", {
      platform,
      telegramHost: safeConnectURLHost(connectURL)
    });

    return {
      opened: true,
      mode: "open"
    };
  } catch (error) {
    logger.warn("Telegram connect action failed; falling back to manual URL", {
      platform,
      error: error.message
    });

    return {
      opened: false,
      mode: "print"
    };
  }
}

function runLauncher(invocation, spawnImpl) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(invocation.command, invocation.args, {
      stdio: "ignore",
      ...invocation.options
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`launcher exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });
  });
}

function safeConnectURLHost(connectURL) {
  const url = new URL(connectURL);
  return url.searchParams.get("server") || "unknown";
}
