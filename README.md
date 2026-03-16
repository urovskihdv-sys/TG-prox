# TG-prox

Windows-first MVP for a local Telegram proxy agent.

## Current slice

The repository now contains a runnable local-agent bootstrap focused on the control-plane path:

- config/model normalization
- remote config loader over HTTPS
- cache fallback on fetch failure
- bundled default fallback when cache is missing
- file + stderr logging without payload logging
- local SOCKS5 adapter with `CONNECT` support and direct outbound transport
- macOS `.pkg` background install path via `LaunchAgent`

This is intentionally a vertical slice for the MVP foundation. No relay/data-plane is routed through our server in this phase.

## Runtime

- Node.js 18+
- No external dependencies yet

## Run

```bash
npm start
```

This starts a long-running local agent and binds the SOCKS5 listener from the resolved config. Current default is `127.0.0.1:9150`.

To start the agent and trigger a Telegram Desktop connect action:

```bash
npm run connect
```

To print the deep link without opening Telegram:

```bash
npm run connect-url
```

Optional environment variables:

- `TGPROX_REMOTE_CONFIG_URL=https://control.example.com/config.json`
- `TGPROX_REMOTE_CONFIG_TIMEOUT_MS=5000`
- `TGPROX_HOME=/custom/runtime/dir`
- `TGPROX_DEFAULT_CONFIG_PATH=/custom/default.remote-config.json`

Without `TGPROX_REMOTE_CONFIG_URL`, the app skips the remote fetch and uses `cache -> default` fallback locally.

## Current SOCKS5 scope

- SOCKS5 version `5`
- authentication: `NO AUTH`
- command support: `CONNECT`
- address support: IPv4, domain name, IPv6
- transport mode: direct outbound TCP only

This keeps the MVP aligned with the current decision: control plane over HTTPS, no relay/data-plane through our server.

## Telegram connect flow

- `connect-url` resolves the active config and prints a `tg://socks?...` deep link.
- `connect` starts the local agent and tries to open that deep link with the platform launcher.
- On Windows this uses `cmd.exe /c start` so Telegram Desktop can pick up the registered `tg://` protocol handler.
- If the launcher or protocol handler is unavailable, TG-prox falls back to printing the deep link for manual use.

## Windows packaging slice

Build the current Windows dev payload with:

```bash
npm run dist:windows
```

This creates `dist/windows/TG-prox/` with:

- `TG-prox.cmd` as the primary Windows entrypoint for `connect`
- `TG-prox-connect-url.cmd` for printing the deep link
- `TG-prox.ps1` for PowerShell usage
- `INSTALLER-METADATA.json` describing install scope, shortcuts, and prerequisites
- `TG-prox.iss` as a rendered Inno Setup script for the current package version
- copied `app/` and `config/` runtime assets

This payload still requires Node.js on the user machine. It is not the release installer target.

Build the current macOS dev payload with:

```bash
npm run dist:macos
```

This payload also still requires Node.js on the user machine. It is not the release installer target.

## Release Targets

The release targets are:

- Windows: standalone installer `.exe`
- macOS: installer `.pkg`

The old script-installers remain fallback/dev artifacts only.

Build fallback/dev installers with:

```bash
npm run dist:fallback-installers
```

This produces:

- `dist/fallback-installers/TG-prox-windows-fallback-installer-<version>.ps1`
- `dist/fallback-installers/TG-prox-macos-fallback-installer-<version>.command`

These are not the product installers.

## Final Installer Status

Attempt the final release installer build with:

```bash
npm run dist:installers
```

This writes:

- `dist/installers/BUILD-STATUS.json`

If prerequisites are available, the intended final outputs are:

- `dist/installers/TG-prox-windows-installer-<version>.exe`
- `dist/installers/TG-prox-macos-installer-<version>.pkg`

If prerequisites are missing, `BUILD-STATUS.json` records the blocker instead of pretending the release installers exist.

## Fastest Path: GitHub Actions

If the repo is on GitHub, the lowest-manual-work path is:

1. Push this repository to GitHub.
2. Open `Actions`.
3. Run `Build Release Installers`.
4. Wait for the Windows and macOS jobs to finish.
5. Download artifacts:
   - `tg-prox-windows-installer`
   - `tg-prox-macos-installer`

The workflow file is [release-installers.yml](/opt/TG-prox/.github/workflows/release-installers.yml). It uses GitHub-hosted Windows and macOS runners, runs tests first, prepares the bundled Node runtime on the runner, then builds the release installers.

## Windows installer behavior

The Windows release installer is now intended to install once and keep working without a manual terminal session. The `.exe` path now:

- bundles its own Node runtime
- registers a per-user `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry
- starts TG-prox in background through `wscript.exe` after install
- keeps the local SOCKS5 listener coming back after login

Current limits:

- the post-install connect flow still depends on Telegram Desktop being installed and registered for `tg://`
- Windows code signing is still a follow-up, so SmartScreen reputation warnings are still possible

## macOS package behavior

The macOS release package now installs:

- `/Applications/TG-prox.app`
- `/Library/LaunchAgents/local.tgprox.agent.plist`

The packaged postinstall path:

- bootstraps the `launchd` agent so the local SOCKS5 listener survives Terminal closure
- keeps the listener running again after user login
- opens `TG-prox.app` once so Telegram can receive the `tg://socks` connect action without a manual Terminal step

Current limits:

- the package is still unsigned and not notarized, so Gatekeeper may require `Open Anyway`
- macOS remains best-effort beta
- Windows installer packaging exists, but the same “install once and always-on background agent” finish is still a follow-up on Windows

## Standalone Packaging Paths

Windows standalone payload path:

```bash
npm run dist:windows:standalone
npm run dist:windows:exe
```

This path expects:

- vendored Windows runtime at `vendor/runtime/windows-x64/node.exe` or `TGPROX_WINDOWS_NODE_RUNTIME_DIR`
- Windows host/runner with Inno Setup `iscc`

macOS app/pkg path:

```bash
npm run dist:macos:app
npm run dist:macos:pkg
```

This path expects:

- vendored macOS runtime at `vendor/runtime/macos-universal/bin/node` or `TGPROX_MACOS_NODE_RUNTIME_DIR`
- macOS host/runner with `pkgbuild` and `productbuild`

## What This Host Can Build

On the current Linux host, the repo can build:

- runnable dev payloads in `dist/windows/` and `dist/macos/`
- fallback/dev script installers in `dist/fallback-installers/`
- Windows standalone payload scaffolding if a vendored Windows Node runtime is provided

The current Linux host cannot produce a final macOS `.pkg`.

## What Requires Another Host

- Windows `.exe` installer:
  requires a Windows host/runner with Inno Setup `iscc` and a vendored Windows Node runtime for the standalone payload

- macOS `.pkg` installer:
  requires a macOS host/runner with `pkgbuild` and `productbuild`, plus a vendored macOS Node runtime for the `.app` bundle

## Test

```bash
npm test
```

## Windows-first note

The runtime path layout already prefers `%APPDATA%\\TG-prox` on Windows. macOS remains best-effort beta. On Linux/dev, the default runtime directory is repo-local `runtime/` so the bootstrap runs without extra setup.
