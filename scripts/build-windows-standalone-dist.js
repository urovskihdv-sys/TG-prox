import fs from "node:fs/promises";
import path from "node:path";
import {
  BuildBlocker,
  copyProjectFile,
  copyProjectPath,
  distRoot,
  ensureCleanDir,
  isMainModule,
  projectRoot,
  readPackageJson,
  renderTemplate,
  requirePath,
  resolveRuntimeDir,
  writeJson
} from "./packaging-helpers.js";

const standaloneRoot = path.join(distRoot, "windows-standalone", "TG-prox");

export async function buildWindowsStandaloneDist() {
  const packageJson = await readPackageJson();
  const runtimeDir = resolveRuntimeDir(
    "TGPROX_WINDOWS_NODE_RUNTIME_DIR",
    "vendor/runtime/windows-x64"
  );
  const nodeExePath = path.join(runtimeDir, "node.exe");

  await requirePath(
    nodeExePath,
    "Windows standalone build requires a vendored Windows Node runtime at vendor/runtime/windows-x64/node.exe or TGPROX_WINDOWS_NODE_RUNTIME_DIR.",
    {
      hostBuildableNow: false,
      target: "windows-exe",
      requiredHost: "windows-runner",
      runtimePath: nodeExePath
    }
  );

  await ensureCleanDir(standaloneRoot);

  await copyProjectPath("app", path.join(standaloneRoot, "app"), {
    filter(sourcePath) {
      return !sourcePath.endsWith(".test.js");
    }
  });
  await copyProjectPath("config", path.join(standaloneRoot, "config"));
  await copyProjectPath("package.json", path.join(standaloneRoot, "package.json"));
  await copyProjectPath("README.md", path.join(standaloneRoot, "README.md"));
  await fs.cp(runtimeDir, path.join(standaloneRoot, "runtime", "node"), { recursive: true });

  await copyProjectFile(
    "packaging/windows/TG-prox-standalone.cmd",
    path.join(standaloneRoot, "TG-prox.cmd")
  );
  await copyProjectFile(
    "packaging/windows/TG-prox-connect-url-standalone.cmd",
    path.join(standaloneRoot, "TG-prox-connect-url.cmd")
  );
  await copyProjectFile(
    "packaging/windows/README-standalone.txt",
    path.join(standaloneRoot, "README.txt")
  );

  const metadataTemplate = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, "packaging", "windows", "INSTALLER-METADATA-standalone.json"),
      "utf8"
    )
  );
  const templatePath = path.join(projectRoot, "packaging", "windows", "TG-prox-standalone.iss");
  const issTemplate = await fs.readFile(templatePath, "utf8");

  await writeJson(path.join(standaloneRoot, "INSTALLER-METADATA.json"), {
    ...metadataTemplate,
    version: packageJson.version,
    builtAt: new Date().toISOString()
  });
  await fs.writeFile(
    path.join(standaloneRoot, "TG-prox-standalone.iss"),
    renderTemplate(issTemplate, {
      "__APP_VERSION__": packageJson.version
    }),
    "utf8"
  );
  await writeJson(path.join(standaloneRoot, "BUILD-INFO.json"), {
    version: packageJson.version,
    runtimeBundle: "embedded-node",
    finalTarget: "windows-exe"
  });

  return standaloneRoot;
}

if (isMainModule(import.meta)) {
  try {
    await buildWindowsStandaloneDist();
  } catch (error) {
    if (error instanceof BuildBlocker) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
