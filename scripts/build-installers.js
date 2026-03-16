import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const installersRoot = path.join(distRoot, "installers");

async function main() {
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));

  await runNodeScript("scripts/build-windows-dist.js");
  await runNodeScript("scripts/build-macos-dist.js");

  await fs.rm(installersRoot, { recursive: true, force: true });
  await fs.mkdir(installersRoot, { recursive: true });

  const windowsDistRoot = path.join(distRoot, "windows", "TG-prox");
  const macosDistRoot = path.join(distRoot, "macos", "TG-prox");

  const windowsPayloadZip = path.join(installersRoot, "TG-prox-windows-payload.zip");
  const macosPayloadTarGz = path.join(installersRoot, "TG-prox-macos-payload.tar.gz");

  await buildZipArchive(windowsDistRoot, windowsPayloadZip);
  await buildTarGzArchive(macosDistRoot, macosPayloadTarGz);

  const windowsPayloadBase64 = await readBase64(windowsPayloadZip);
  const macosPayloadBase64 = await readBase64(macosPayloadTarGz);

  const windowsInstallerPath = path.join(
    installersRoot,
    `TG-prox-windows-installer-${packageJson.version}.ps1`
  );
  const macosInstallerPath = path.join(
    installersRoot,
    `TG-prox-macos-installer-${packageJson.version}.command`
  );

  await fs.writeFile(
    windowsInstallerPath,
    renderWindowsInstaller({
      version: packageJson.version,
      payloadBase64: windowsPayloadBase64
    }),
    "utf8"
  );

  await fs.writeFile(
    macosInstallerPath,
    renderMacOSInstaller({
      version: packageJson.version,
      payloadBase64: macosPayloadBase64
    }),
    "utf8"
  );

  await fs.chmod(macosInstallerPath, 0o755);
  await fs.rm(windowsPayloadZip, { force: true });
  await fs.rm(macosPayloadTarGz, { force: true });

  await fs.writeFile(
    path.join(installersRoot, "INSTALLERS.json"),
    `${JSON.stringify(
      {
        version: packageJson.version,
        builtAt: new Date().toISOString(),
        artifacts: [
          path.basename(windowsInstallerPath),
          path.basename(macosInstallerPath)
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  process.stdout.write(`Built installers in ${installersRoot}\n`);
}

async function runNodeScript(relativeScriptPath) {
  await execFileAsync(process.execPath, [path.join(projectRoot, relativeScriptPath)], {
    cwd: projectRoot
  });
}

async function buildZipArchive(sourceDir, archivePath) {
  await execFileAsync("zip", ["-r", archivePath, "."], {
    cwd: sourceDir
  });
}

async function buildTarGzArchive(sourceDir, archivePath) {
  await execFileAsync("tar", ["-czf", archivePath, "."], {
    cwd: sourceDir
  });
}

async function readBase64(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return fileBuffer.toString("base64");
}

function renderWindowsInstaller({ version, payloadBase64 }) {
  return `param(
  [switch]$LaunchAfterInstall = $true
)

$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\\TG-prox"
$tempRoot = Join-Path $env:TEMP "TG-prox-installer-${version}"
$zipPath = Join-Path $tempRoot "payload.zip"
$extractRoot = Join-Path $tempRoot "payload"
$startMenuRoot = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\TG-prox"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "TG-prox requires Node.js 18 or newer on PATH."
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

New-Item -ItemType Directory -Path $startMenuRoot -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell

$primaryShortcut = $shell.CreateShortcut((Join-Path $startMenuRoot "TG-prox.lnk"))
$primaryShortcut.TargetPath = "cmd.exe"
$primaryShortcut.Arguments = "/c ""$installRoot\\TG-prox.cmd"""
$primaryShortcut.WorkingDirectory = $installRoot
$primaryShortcut.Save()

$urlShortcut = $shell.CreateShortcut((Join-Path $startMenuRoot "TG-prox Connect URL.lnk"))
$urlShortcut.TargetPath = "cmd.exe"
$urlShortcut.Arguments = "/c ""$installRoot\\TG-prox-connect-url.cmd"""
$urlShortcut.WorkingDirectory = $installRoot
$urlShortcut.Save()

Write-Host "TG-prox installed to $installRoot"

if ($LaunchAfterInstall) {
  & (Join-Path $installRoot "TG-prox.cmd")
}
`;
}

function renderMacOSInstaller({ version, payloadBase64 }) {
  return `#!/bin/bash
set -euo pipefail

INSTALL_ROOT="$HOME/Applications/TG-prox"
TEMP_ROOT="$(mktemp -d "/tmp/tg-prox-installer-${version}.XXXXXX")"
PAYLOAD_PATH="$TEMP_ROOT/payload.tar.gz"
EXTRACT_ROOT="$TEMP_ROOT/payload"

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

if ! command -v node >/dev/null 2>&1; then
  echo "TG-prox requires Node.js 18 or newer on PATH." >&2
  exit 1
fi

mkdir -p "$EXTRACT_ROOT"
awk 'found { print } /^__TGPROX_PAYLOAD_BELOW__$/ { found = 1 }' "$0" | tail -n +2 | base64 --decode > "$PAYLOAD_PATH"
tar -xzf "$PAYLOAD_PATH" -C "$EXTRACT_ROOT"

rm -rf "$INSTALL_ROOT"
mkdir -p "$(dirname "$INSTALL_ROOT")"
cp -R "$EXTRACT_ROOT/." "$INSTALL_ROOT"
chmod +x "$INSTALL_ROOT/TG-prox.command" "$INSTALL_ROOT/TG-prox-connect-url.command"

echo "TG-prox installed to $INSTALL_ROOT"
echo "Launch with: $INSTALL_ROOT/TG-prox.command"
exit 0
__TGPROX_PAYLOAD_BELOW__
${payloadBase64}
`;
}

await main();
