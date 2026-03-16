import fs from "node:fs/promises";
import path from "node:path";
import {
  BuildBlocker,
  copyProjectFile,
  describeCurrentHost,
  distRoot,
  ensureDir,
  ensureCleanDir,
  execFileAsync,
  findExecutable,
  isMainModule,
  projectRoot,
  readPackageJson
} from "./packaging-helpers.js";
import { buildMacOSAppDist } from "./build-macos-app-dist.js";

export async function buildMacOSPkgInstaller() {
  if (process.platform !== "darwin") {
    throw new BuildBlocker(
      "macOS .pkg build requires a macOS host with pkgbuild and productbuild.",
      {
        target: "macos-pkg",
        host: describeCurrentHost(),
        requiredHost: "macos-runner",
        missingTools: ["pkgbuild", "productbuild"],
        requiredRuntime: "vendor/runtime/macos-universal/bin/node"
      }
    );
  }

  const pkgbuildPath = await findExecutable(["pkgbuild"], "TGPROX_PKGBUILD_PATH");
  const productbuildPath = await findExecutable(["productbuild"], "TGPROX_PRODUCTBUILD_PATH");
  if (!pkgbuildPath || !productbuildPath) {
    throw new BuildBlocker("macOS .pkg build requires pkgbuild and productbuild.", {
      target: "macos-pkg",
      host: describeCurrentHost(),
      requiredHost: "macos-runner",
      requiredRuntime: "vendor/runtime/macos-universal/bin/node",
      missingTools: [
        ...(pkgbuildPath ? [] : ["pkgbuild"]),
        ...(productbuildPath ? [] : ["productbuild"])
      ]
    });
  }

  const packageJson = await readPackageJson();
  const appBundlePath = await buildMacOSAppDist();
  const installersRoot = path.join(distRoot, "installers");
  await ensureDir(installersRoot);
  const pkgRoot = path.join(distRoot, "macos-pkg-root");
  const pkgScriptsRoot = path.join(distRoot, "macos-pkg-scripts");
  await ensureCleanDir(pkgRoot);
  await ensureCleanDir(pkgScriptsRoot);

  await ensureDir(path.join(pkgRoot, "Applications"));
  await ensureDir(path.join(pkgRoot, "Library", "LaunchAgents"));
  await fs.cp(appBundlePath, path.join(pkgRoot, "Applications", "TG-prox.app"), { recursive: true });

  const plistTemplate = await fs.readFile(
    path.join(projectRoot, "packaging", "macos", "local.tgprox.agent.plist.template"),
    "utf8"
  );
  await fs.writeFile(
    path.join(pkgRoot, "Library", "LaunchAgents", "local.tgprox.agent.plist"),
    plistTemplate,
    "utf8"
  );
  await copyProjectFile("packaging/macos/postinstall", path.join(pkgScriptsRoot, "postinstall"));
  await fs.chmod(path.join(pkgScriptsRoot, "postinstall"), 0o755);

  const componentPkgPath = path.join(installersRoot, `TG-prox-macos-component-${packageJson.version}.pkg`);
  const finalPkgPath = path.join(installersRoot, `TG-prox-macos-installer-${packageJson.version}.pkg`);

  await execFileAsync(pkgbuildPath, [
    "--root",
    pkgRoot,
    "--scripts",
    pkgScriptsRoot,
    "--identifier",
    "local.tgprox.pkg",
    "--version",
    packageJson.version,
    "--install-location",
    "/",
    componentPkgPath
  ]);

  await execFileAsync(productbuildPath, ["--package", componentPkgPath, finalPkgPath]);
  return finalPkgPath;
}

if (isMainModule(import.meta)) {
  try {
    const artifactPath = await buildMacOSPkgInstaller();
    process.stdout.write(`Built macOS .pkg installer at ${artifactPath}\n`);
  } catch (error) {
    if (error instanceof BuildBlocker) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
