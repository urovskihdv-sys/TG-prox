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
  const transportMode = normalizeTransportMode(rawConfig.transport?.mode);
  const relayServerURL = normalizeRelayServerURL(rawConfig.transport?.relay?.serverURL);
  const relayAuthToken = normalizeOptionalSecret(rawConfig.transport?.relay?.authToken);
  const relayCACertPath = normalizeOptionalString(rawConfig.transport?.relay?.caCertPath);

  if (transportMode === "relay") {
    if (!relayServerURL) {
      throw new ConfigValidationError("transport.relay.serverURL is required when transport.mode is 'relay'");
    }

    if (!relayAuthToken) {
      throw new ConfigValidationError("transport.relay.authToken is required when transport.mode is 'relay'");
    }
  }

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
      mode: transportMode,
      connectTimeoutMs: normalizePositiveInteger(
        rawConfig.transport?.connectTimeoutMs,
        10000,
        "transport.connectTimeoutMs"
      ),
      relay: {
        serverURL: relayServerURL,
        authToken: relayAuthToken,
        caCertPath: relayCACertPath
      }
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

export function resolveRuntimeConfigOverrides(env = process.env) {
  return {
    transportMode: normalizeOptionalString(env.TGPROX_TRANSPORT_MODE),
    relayServerURL: normalizeRelayServerURL(env.TGPROX_RELAY_URL || ""),
    relayAuthToken: normalizeOptionalSecret(env.TGPROX_RELAY_AUTH_TOKEN),
    relayCACertPath: normalizeOptionalString(env.TGPROX_RELAY_CA_CERT_PATH)
  };
}

export function applyRuntimeConfigOverrides(baseConfig, overrides) {
  if (!overrides) {
    return baseConfig;
  }

  const merged = structuredClone(baseConfig);
  merged.transport ||= {};
  merged.transport.relay ||= {};

  if (overrides.transportMode) {
    merged.transport.mode = overrides.transportMode;
  }

  if (overrides.relayServerURL) {
    merged.transport.relay.serverURL = overrides.relayServerURL;
  }

  if (overrides.relayAuthToken) {
    merged.transport.relay.authToken = overrides.relayAuthToken;
  }

  if (overrides.relayCACertPath) {
    merged.transport.relay.caCertPath = overrides.relayCACertPath;
  }

  return normalizeRemoteConfig(merged);
}

function normalizeNonEmptyString(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  if (value !== "direct" && value !== "relay") {
    throw new ConfigValidationError("transport.mode must be 'direct' or 'relay'");
  }

  return value;
}

function normalizeRelayServerURL(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }

  let parsedURL;
  try {
    parsedURL = new URL(normalized);
  } catch (error) {
    throw new ConfigValidationError(`invalid relay server URL: ${error.message}`);
  }

  if (parsedURL.protocol !== "https:") {
    throw new ConfigValidationError("relay server URL must use HTTPS");
  }

  return parsedURL.origin;
}

function normalizeOptionalSecret(value) {
  return normalizeOptionalString(value);
}
