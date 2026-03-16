import path from "node:path";
import {
  blockerToStatus,
  describeCurrentHost,
  distRoot,
  ensureCleanDir,
  isMainModule,
  readPackageJson,
  writeJson
} from "./packaging-helpers.js";
import { buildMacOSPkgInstaller } from "./build-macos-pkg.js";
import { buildWindowsExeInstaller } from "./build-windows-exe-installer.js";

const installersRoot = path.join(distRoot, "installers");

export async function buildInstallers() {
  const packageJson = await readPackageJson();
  await ensureCleanDir(installersRoot);

  const results = {
    version: packageJson.version,
    builtAt: new Date().toISOString(),
    host: describeCurrentHost(),
    currentHostBuildableNow: [
      {
        script: "npm run dist:windows",
        output: "dist/windows/TG-prox",
        kind: "dev-payload"
      },
      {
        script: "npm run dist:macos",
        output: "dist/macos/TG-prox",
        kind: "dev-payload"
      },
      {
        script: "npm run dist:fallback-installers",
        output: "dist/fallback-installers",
        kind: "fallback-dev-only"
      }
    ],
    fallbackArtifacts: {
      directory: "dist/fallback-installers",
      note: "Script installers are fallback/dev artifacts only and are not the release target."
    },
    finalTargets: {}
  };

  results.finalTargets.windows = await attemptTarget(
    "windows-exe",
    `TG-prox-windows-installer-${packageJson.version}.exe`,
    buildWindowsExeInstaller
  );
  results.finalTargets.macos = await attemptTarget(
    "macos-pkg",
    `TG-prox-macos-installer-${packageJson.version}.pkg`,
    buildMacOSPkgInstaller
  );

  await writeJson(path.join(installersRoot, "BUILD-STATUS.json"), results);
  return results;
}

async function attemptTarget(targetId, artifactName, buildFn) {
  try {
    const artifactPath = await buildFn();
    return {
      target: targetId,
      status: "built",
      artifactPath,
      artifactName
    };
  } catch (error) {
    return {
      target: targetId,
      ...blockerToStatus(error)
    };
  }
}

if (isMainModule(import.meta)) {
  const results = await buildInstallers();
  process.stdout.write(`Wrote installer build status to ${path.join(installersRoot, "BUILD-STATUS.json")}\n`);

  const builtArtifacts = Object.values(results.finalTargets).filter((target) => target.status === "built");
  if (builtArtifacts.length > 0) {
    for (const artifact of builtArtifacts) {
      process.stdout.write(`Built ${artifact.target}: ${artifact.artifactPath}\n`);
    }
  }
}
