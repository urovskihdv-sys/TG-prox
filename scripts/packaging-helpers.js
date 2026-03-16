import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(__dirname, "..");
export const distRoot = path.join(projectRoot, "dist");

export class BuildBlocker extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BuildBlocker";
    this.details = details;
  }
}

export async function readPackageJson() {
  return JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
}

export async function ensureCleanDir(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function copyProjectPath(relativePath, targetPath, options = {}) {
  const sourcePath = path.join(projectRoot, relativePath);
  await fs.cp(sourcePath, targetPath, { recursive: true, ...options });
}

export async function copyProjectFile(relativePath, targetPath) {
  await ensureDir(path.dirname(targetPath));
  await fs.copyFile(path.join(projectRoot, relativePath), targetPath);
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.replaceAll(key, value);
  }, template);
}

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function requirePath(filePath, message, details = {}) {
  if (!(await exists(filePath))) {
    throw new BuildBlocker(message, {
      ...details,
      path: filePath
    });
  }
}

export function resolveRuntimeDir(envKey, defaultRelativePath) {
  if (process.env[envKey]) {
    return path.resolve(process.env[envKey]);
  }

  return path.join(projectRoot, defaultRelativePath);
}

export async function findExecutable(candidates, envKey) {
  if (envKey && process.env[envKey]) {
    const configuredPath = path.resolve(process.env[envKey]);
    if (await exists(configuredPath)) {
      return configuredPath;
    }
  }

  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    for (const candidate of candidates) {
      const candidatePath = path.join(entry, candidate);
      if (await exists(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

export function describeCurrentHost() {
  return {
    platform: process.platform,
    arch: process.arch
  };
}

export function blockerToStatus(error) {
  if (error instanceof BuildBlocker) {
    return {
      status: "blocked",
      reason: error.message,
      details: error.details
    };
  }

  return {
    status: "failed",
    reason: error.message
  };
}

export function isMainModule(importMeta) {
  return process.argv[1] === fileURLToPath(importMeta.url);
}
