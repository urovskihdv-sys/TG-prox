const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export class ConfigValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export function normalizeRemoteConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new ConfigValidationError("remote config must be a JSON object");
  }

  const proxyHost = normalizeNonEmptyString(rawConfig.proxy?.listenHost, "127.0.0.1");
  const proxyPort = normalizePort(rawConfig.proxy?.listenPort, 9150, "proxy.listenPort");

  return {
    schemaVersion: normalizePositiveInteger(rawConfig.schemaVersion, 1, "schemaVersion"),
    version: normalizeVersion(rawConfig.version),
    updatedAt: normalizeTimestamp(rawConfig.updatedAt),
    proxy: {
      listenHost: proxyHost,
      listenPort: proxyPort,
      handshakeTimeoutMs: normalizePositiveInteger(
        rawConfig.proxy?.handshakeTimeoutMs,
        10000,
        "proxy.handshakeTimeoutMs"
      )
    },
    telegram: {
      socksHost: normalizeNonEmptyString(rawConfig.telegram?.socksHost, proxyHost),
      socksPort: normalizePort(rawConfig.telegram?.socksPort, proxyPort, "telegram.socksPort")
    },
    transport: {
      mode: normalizeTransportMode(rawConfig.transport?.mode),
      connectTimeoutMs: normalizePositiveInteger(
        rawConfig.transport?.connectTimeoutMs,
        10000,
        "transport.connectTimeoutMs"
      )
    },
    controlPlane: {
      refreshIntervalMs: normalizePositiveInteger(
        rawConfig.controlPlane?.refreshIntervalMs,
        300000,
        "controlPlane.refreshIntervalMs"
      )
    }
  };
}

export function normalizeRemoteConfigURL(rawURL) {
  if (!rawURL) {
    return null;
  }

  let parsedURL;
  try {
    parsedURL = new URL(rawURL);
  } catch (error) {
    throw new ConfigValidationError(`invalid remote config URL: ${error.message}`);
  }

  if (parsedURL.protocol !== "https:" && !isLoopback(parsedURL.hostname)) {
    throw new ConfigValidationError("remote config URL must use HTTPS unless it points to localhost");
  }

  return parsedURL;
}

function normalizeNonEmptyString(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function normalizePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigValidationError(`${fieldName} must be a positive integer`);
  }

  return value;
}

function normalizePort(value, fallback, fieldName) {
  const port = normalizePositiveInteger(value, fallback, fieldName);
  if (port > 65535) {
    throw new ConfigValidationError(`${fieldName} must be <= 65535`);
  }

  return port;
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "1970-01-01T00:00:00.000Z";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ConfigValidationError("updatedAt must be a valid ISO-8601 timestamp");
  }

  return date.toISOString();
}

function normalizeVersion(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "default";
  }

  return value.trim();
}

function isLoopback(hostname) {
  return LOOPBACK_HOSTS.has(hostname);
}

function normalizeTransportMode(value) {
  if (value === undefined || value === null || value === "") {
    return "direct";
  }

  if (value !== "direct") {
    throw new ConfigValidationError("transport.mode must be 'direct'");
  }

  return value;
}
