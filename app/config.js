import { normalizeRemoteConfigURL, resolveRuntimeConfigOverrides } from "./model.js";
import { resolveRuntimePaths } from "./runtime-paths.js";

export function buildAppConfig(env = process.env) {
  const paths = resolveRuntimePaths(env);
  const remoteConfigURL = normalizeRemoteConfigURL(env.TGPROX_REMOTE_CONFIG_URL || "");

  return {
    appName: "TG-prox",
    env: env.TGPROX_ENV || "development",
    paths,
    runtimeOverrides: resolveRuntimeConfigOverrides(env),
    controlPlane: {
      remoteConfigURL,
      timeoutMs: parseTimeout(env.TGPROX_REMOTE_CONFIG_TIMEOUT_MS)
    }
  };
}

function parseTimeout(rawValue) {
  if (!rawValue) {
    return 5000;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 5000;
  }

  return parsed;
}
