import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_FOLDER_NAME = "TG-prox";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveRuntimePaths(env = process.env, platform = process.platform) {
  const appHome = env.TGPROX_HOME || resolveAppHome(platform, env);

  return {
    projectRoot: PROJECT_ROOT,
    appHome,
    cacheDir: path.join(appHome, "cache"),
    logDir: path.join(appHome, "logs"),
    defaultConfigPath:
      env.TGPROX_DEFAULT_CONFIG_PATH || path.join(PROJECT_ROOT, "config", "default.remote-config.json"),
    cacheFilePath: path.join(appHome, "cache", "remote-config.json"),
    logFilePath: path.join(appHome, "logs", "tg-prox.log")
  };
}

function resolveAppHome(platform, env) {
  if (platform === "win32") {
    const baseDir = env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(baseDir, APP_FOLDER_NAME);
  }

  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_FOLDER_NAME);
  }

  if (env.XDG_STATE_HOME) {
    return path.join(env.XDG_STATE_HOME, APP_FOLDER_NAME.toLowerCase());
  }

  return path.join(PROJECT_ROOT, "runtime");
}
