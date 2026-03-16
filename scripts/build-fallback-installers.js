import fs from "node:fs/promises";
import path from "node:path";
import {
  copyProjectFile,
  copyProjectPath,
  distRoot,
  ensureCleanDir,
  ensureDir,
  isMainModule,
  readPackageJson,
  writeJson
} from "./packaging-helpers.js";

const fallbackRoot = path.join(distRoot, "fallback-installers");

export async function buildFallbackInstallers() {
  const packageJson = await readPackageJson();
  const windowsDistRoot = path.join(distRoot, "windows", "TG-prox");
  const macosDistRoot = path.join(distRoot, "macos", "TG-prox");

  await ensureCleanDir(fallbackRoot);
  await buildWindowsFallbackPayload(windowsDistRoot, packageJson.version);
  await buildMacOSFallbackPayload(macosDistRoot, packageJson.version);

  const windowsPayloadZip = path.join(fallbackRoot, "TG-prox-windows-fallback-payload.zip");
  const macosPayloadTarGz = path.join(fallbackRoot, "TG-prox-macos-fallback-payload.tar.gz");

  await buildArchive("zip", ["-r", windowsPayloadZip, "."], windowsDistRoot);
  await buildArchive("tar", ["-czf", macosPayloadTarGz, "."], macosDistRoot);

  const windowsPayloadBase64 = await readBase64(windowsPayloadZip);
  const macosPayloadBase64 = await readBase64(macosPayloadTarGz);

  const windowsInstallerPath = path.join(
    fallbackRoot,
    `TG-prox-windows-fallback-installer-${packageJson.version}.ps1`
  );
  const macosInstallerPath = path.join(
    fallbackRoot,
    `TG-prox-macos-fallback-installer-${packageJson.version}.command`
  );

  await fs.writeFile(
    windowsInstallerPath,
    renderWindowsFallbackInstaller(packageJson.version, windowsPayloadBase64),
    "utf8"
  );
  await fs.writeFile(
    macosInstallerPath,
    renderMacOSFallbackInstaller(packageJson.version, macosPayloadBase64),
    "utf8"
  );
  await fs.chmod(macosInstallerPath, 0o755);

  await fs.rm(windowsPayloadZip, { force: true });
  await fs.rm(macosPayloadTarGz, { force: true });

  await writeJson(path.join(fallbackRoot, "FALLBACK-INSTALLERS.json"), {
    version: packageJson.version,
    kind: "fallback-dev-only",
    artifacts: [path.basename(windowsInstallerPath), path.basename(macosInstallerPath)]
  });
}

async function buildWindowsFallbackPayload(distPath, version) {
  await ensureCleanDir(distPath);
  await copyAppPayload(distPath);
  await copyProjectFile("packaging/windows/TG-prox.cmd", path.join(distPath, "TG-prox.cmd"));
  await copyProjectFile(
    "packaging/windows/TG-prox-connect-url.cmd",
    path.join(distPath, "TG-prox-connect-url.cmd")
  );
  await copyProjectFile("packaging/windows/TG-prox.ps1", path.join(distPath, "TG-prox.ps1"));
  await copyProjectFile("packaging/windows/README.txt", path.join(distPath, "README.txt"));
  await writeJson(path.join(distPath, "BUILD-INFO.json"), {
    name: "tg-prox",
    version,
    buildKind: "fallback-node-runtime-required"
  });
}

async function buildMacOSFallbackPayload(distPath, version) {
  await ensureCleanDir(distPath);
  await copyAppPayload(distPath);
  await copyProjectFile("packaging/macos/TG-prox.command", path.join(distPath, "TG-prox.command"));
  await copyProjectFile(
    "packaging/macos/TG-prox-connect-url.command",
    path.join(distPath, "TG-prox-connect-url.command")
  );
  await copyProjectFile("packaging/macos/README.txt", path.join(distPath, "README.txt"));
  await fs.chmod(path.join(distPath, "TG-prox.command"), 0o755);
  await fs.chmod(path.join(distPath, "TG-prox-connect-url.command"), 0o755);
  await writeJson(path.join(distPath, "BUILD-INFO.json"), {
    name: "tg-prox",
    version,
    buildKind: "fallback-node-runtime-required"
  });
}

async function copyAppPayload(targetRoot) {
  await copyProjectPath("app", path.join(targetRoot, "app"), {
    filter(sourcePath) {
      return !sourcePath.endsWith(".test.js");
    }
  });
  await copyProjectPath("config", path.join(targetRoot, "config"));
  await copyProjectPath("package.json", path.join(targetRoot, "package.json"));
  await copyProjectPath("README.md", path.join(targetRoot, "README.md"));
}

async function buildArchive(command, args, cwd) {
  const { execFileAsync } = await import("./packaging-helpers.js");
  await execFileAsync(command, args, { cwd });
}

async function readBase64(filePath) {
  return (await fs.readFile(filePath)).toString("base64");
}

function renderWindowsFallbackInstaller(version, payloadBase64) {
  return `param()

$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\\TG-prox-fallback"
$tempRoot = Join-Path $env:TEMP "TG-prox-fallback-${version}"
$zipPath = Join-Path $tempRoot "payload.zip"
$extractRoot = Join-Path $tempRoot "payload"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "TG-prox fallback installer requires Node.js 18 or newer on PATH."
}

if (Test-Path $tempRoot) {
  Remove-Item -Recurse -Force $tempRoot
}

New-Item -ItemType Directory -Path $tempRoot | Out-Null
[IO.File]::WriteAllBytes($zipPath, [Convert]::FromBase64String(@"
${payloadBase64}
"@))
Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

if (Test-Path $installRoot) {
  Remove-Item -Recurse -Force $installRoot
}

New-Item -ItemType Directory -Path (Split-Path -Parent $installRoot) -Force | Out-Null
Copy-Item -Recurse -Force (Join-Path $extractRoot "*") $installRoot
Write-Host "TG-prox fallback payload installed to $installRoot"
`;
}

function renderMacOSFallbackInstaller(version, payloadBase64) {
  return `#!/bin/bash
set -euo pipefail

INSTALL_ROOT="$HOME/Applications/TG-prox-fallback"
TEMP_ROOT="$(mktemp -d "/tmp/tg-prox-fallback-${version}.XXXXXX")"
PAYLOAD_PATH="$TEMP_ROOT/payload.tar.gz"
EXTRACT_ROOT="$TEMP_ROOT/payload"

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

if ! command -v node >/dev/null 2>&1; then
  echo "TG-prox fallback installer requires Node.js 18 or newer on PATH." >&2
  exit 1
fi

mkdir -p "$EXTRACT_ROOT"
awk 'found { print } /^__TGPROX_PAYLOAD_BELOW__$/ { found = 1 }' "$0" | tail -n +2 | base64 --decode > "$PAYLOAD_PATH"
tar -xzf "$PAYLOAD_PATH" -C "$EXTRACT_ROOT"
rm -rf "$INSTALL_ROOT"
mkdir -p "$(dirname "$INSTALL_ROOT")"
cp -R "$EXTRACT_ROOT/." "$INSTALL_ROOT"
echo "TG-prox fallback payload installed to $INSTALL_ROOT"
exit 0
__TGPROX_PAYLOAD_BELOW__
${payloadBase64}
`;
}

if (isMainModule(import.meta)) {
  await buildFallbackInstallers();
}
