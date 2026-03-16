import path from "node:path";
import {
  BuildBlocker,
  describeCurrentHost,
  distRoot,
  execFileAsync,
  findExecutable,
  isMainModule,
  readPackageJson
} from "./packaging-helpers.js";
import { buildWindowsStandaloneDist } from "./build-windows-standalone-dist.js";

const installersRoot = path.join(distRoot, "installers");

export async function buildWindowsExeInstaller() {
  if (process.platform !== "win32") {
    throw new BuildBlocker(
      "Windows .exe installer build requires a Windows host with Inno Setup available.",
      {
        target: "windows-exe",
        host: describeCurrentHost(),
        requiredHost: "windows-runner",
        missingTools: ["iscc"],
        requiredRuntime: "vendor/runtime/windows-x64/node.exe"
      }
    );
  }

  const isccPath = await findExecutable(["iscc.exe", "iscc"], "TGPROX_ISCC_PATH");
  if (!isccPath) {
    throw new BuildBlocker("Windows .exe installer build requires Inno Setup Compiler (iscc).", {
      target: "windows-exe",
      host: describeCurrentHost(),
      requiredHost: "windows-runner",
      missingTools: ["iscc"],
      requiredRuntime: "vendor/runtime/windows-x64/node.exe"
    });
  }

  const packageJson = await readPackageJson();
  const standaloneRoot = await buildWindowsStandaloneDist();
  const scriptPath = path.join(standaloneRoot, "TG-prox-standalone.iss");

  await execFileAsync(isccPath, [scriptPath], {
    cwd: standaloneRoot
  });

  return path.join(standaloneRoot, `TG-prox-windows-installer-${packageJson.version}.exe`);
}

if (isMainModule(import.meta)) {
  try {
    const artifactPath = await buildWindowsExeInstaller();
    process.stdout.write(`Built Windows .exe installer at ${artifactPath}\n`);
  } catch (error) {
    if (error instanceof BuildBlocker) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
