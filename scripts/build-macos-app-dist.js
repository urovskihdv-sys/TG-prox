import fs from "node:fs/promises";
import path from "node:path";
import {
  BuildBlocker,
  copyProjectFile,
  copyProjectPath,
  distRoot,
  ensureCleanDir,
  ensureDir,
  isMainModule,
  projectRoot,
  readPackageJson,
  renderTemplate,
  requirePath,
  resolveRuntimeDir,
  writeJson
} from "./packaging-helpers.js";

const appBundleRoot = path.join(distRoot, "macos-app", "TG-prox.app");

export async function buildMacOSAppDist() {
  const packageJson = await readPackageJson();
  const runtimeDir = resolveRuntimeDir(
    "TGPROX_MACOS_NODE_RUNTIME_DIR",
    "vendor/runtime/macos-universal"
  );
  const nodeBinPath = path.join(runtimeDir, "bin", "node");

  await requirePath(
    nodeBinPath,
    "macOS .app build requires a vendored macOS Node runtime at vendor/runtime/macos-universal/bin/node or TGPROX_MACOS_NODE_RUNTIME_DIR.",
    {
      hostBuildableNow: process.platform === "darwin",
      target: "macos-app",
      requiredHost: "macos-runner",
      runtimePath: nodeBinPath
    }
  );

  await ensureCleanDir(appBundleRoot);

  const contentsRoot = path.join(appBundleRoot, "Contents");
  const macOSRoot = path.join(contentsRoot, "MacOS");
  const resourcesRoot = path.join(contentsRoot, "Resources");
  const frameworksRoot = path.join(contentsRoot, "Frameworks", "node");

  await ensureDir(macOSRoot);
  await ensureDir(resourcesRoot);
  await ensureDir(frameworksRoot);

  await copyProjectPath("app", path.join(resourcesRoot, "app"), {
    filter(sourcePath) {
      return !sourcePath.endsWith(".test.js");
    }
  });
  await copyProjectPath("config", path.join(resourcesRoot, "config"));
  await copyProjectPath("package.json", path.join(resourcesRoot, "package.json"));
  await copyProjectPath("README.md", path.join(resourcesRoot, "README.md"));
  await fs.cp(runtimeDir, frameworksRoot, { recursive: true });
  await copyProjectFile("packaging/macos/README.txt", path.join(resourcesRoot, "README.txt"));

  const launcherPath = path.join(macOSRoot, "TG-prox");
  const infoPlistTemplatePath = path.join(projectRoot, "packaging", "macos", "Info.plist.template");
  const launcherTemplatePath = path.join(projectRoot, "packaging", "macos", "TG-prox-app-launcher.sh");

  const infoPlistTemplate = await fs.readFile(infoPlistTemplatePath, "utf8");
  const launcherTemplate = await fs.readFile(launcherTemplatePath, "utf8");

  await fs.writeFile(
    path.join(contentsRoot, "Info.plist"),
    renderTemplate(infoPlistTemplate, {
      "__APP_VERSION__": packageJson.version
    }),
    "utf8"
  );
  await fs.writeFile(launcherPath, launcherTemplate, "utf8");
  await fs.chmod(launcherPath, 0o755);

  await writeJson(path.join(contentsRoot, "INSTALLER-METADATA.json"), {
    version: packageJson.version,
    finalTarget: "macos-pkg",
    runtimeBundle: "embedded-node",
    appBundle: "TG-prox.app"
  });

  return appBundleRoot;
}

if (isMainModule(import.meta)) {
  try {
    await buildMacOSAppDist();
  } catch (error) {
    if (error instanceof BuildBlocker) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
