import fs from "node:fs";
import path from "node:path";

const REDACTED_KEYS = new Set(["payload", "content", "body", "messageContents"]);

export function createLogger({ appName, logFilePath, stream = process.stderr } = {}) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

  return {
    info(message, fields) {
      writeLog(stream, logFilePath, appName, "INFO", message, fields);
    },
    warn(message, fields) {
      writeLog(stream, logFilePath, appName, "WARN", message, fields);
    },
    error(message, fields) {
      writeLog(stream, logFilePath, appName, "ERROR", message, fields);
    }
  };
}

function writeLog(stream, logFilePath, appName, level, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    app: appName,
    message,
    ...sanitizeFields(fields)
  };

  const line = JSON.stringify(entry);
  stream.write(`${line}\n`);
  fs.appendFileSync(logFilePath, `${line}\n`, "utf8");
}

function sanitizeFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (REDACTED_KEYS.has(key)) {
        return [key, "[REDACTED]"];
      }

      if (value instanceof Error) {
        return [
          key,
          {
            name: value.name,
            message: value.message
          }
        ];
      }

      return [key, value];
    })
  );
}
