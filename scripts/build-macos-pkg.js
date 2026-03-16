import path from "node:path";
import {
  BuildBlocker,
  describeCurrentHost,
  distRoot,
  ensureDir,
  execFileAsync,
  findExecutable,
  isMainModule,
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
  const componentPkgPath = path.join(installersRoot, `TG-prox-macos-component-${packageJson.version}.pkg`);
  const finalPkgPath = path.join(installersRoot, `TG-prox-macos-installer-${packageJson.version}.pkg`);

  await execFileAsync(pkgbuildPath, [
    "--component",
    appBundlePath,
    "--install-location",
    "/Applications",
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
