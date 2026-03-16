import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist", "macos", "TG-prox");
const packageJsonPath = path.join(projectRoot, "package.json");

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const installerMetadataTemplate = JSON.parse(
    await fs.readFile(path.join(projectRoot, "packaging", "macos", "INSTALLER-METADATA.json"), "utf8")
  );

  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distRoot, { recursive: true });

  await copyPath("app", {
    filter(sourcePath) {
      return !sourcePath.endsWith(".test.js");
    }
  });
  await copyPath("config");
  await copyPath("package.json");
  await copyPath("README.md");

  await copyFile(
    path.join(projectRoot, "packaging", "macos", "TG-prox.command"),
    path.join(distRoot, "TG-prox.command")
  );
  await copyFile(
    path.join(projectRoot, "packaging", "macos", "TG-prox-connect-url.command"),
    path.join(distRoot, "TG-prox-connect-url.command")
  );
  await copyFile(
    path.join(projectRoot, "packaging", "macos", "README.txt"),
    path.join(distRoot, "README.txt")
  );

  const installerMetadata = {
    ...installerMetadataTemplate,
    version: packageJson.version,
    builtAt: new Date().toISOString(),
    artifacts: {
      distributionRoot: ".",
      devLauncher: "TG-prox.command",
      releaseTarget: "dist:macos:pkg"
    }
  };

  await fs.writeFile(
    path.join(distRoot, "INSTALLER-METADATA.json"),
    `${JSON.stringify(installerMetadata, null, 2)}\n`,
    "utf8"
  );

  await fs.chmod(path.join(distRoot, "TG-prox.command"), 0o755);
  await fs.chmod(path.join(distRoot, "TG-prox-connect-url.command"), 0o755);

  await fs.writeFile(
    path.join(distRoot, "BUILD-INFO.json"),
    `${JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        builtAt: new Date().toISOString(),
        buildKind: "dev-node-runtime-required",
        entrypoints: {
          primary: "TG-prox.command",
          connectURL: "TG-prox-connect-url.command"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  process.stdout.write(`Built macOS dist at ${distRoot}\n`);
}

async function copyPath(relativePath, options = {}) {
  const sourcePath = path.join(projectRoot, relativePath);
  const targetPath = path.join(distRoot, relativePath);
  await fs.cp(sourcePath, targetPath, { recursive: true, ...options });
}

async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

await main();
