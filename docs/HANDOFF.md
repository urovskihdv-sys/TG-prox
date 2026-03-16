# Handoff

Status: iteration 7 honest release-packaging boundary complete

Completed in this step:
1. Chosen runtime: Node.js local-agent skeleton with Windows-first path layout.
2. Added config/model normalization and bundled default remote config asset.
3. Added remote config loader with `remote -> cache -> default` fallback.
4. Added file/stderr logging setup with payload/content redaction safeguards.
5. Verified locally with `npm test` and `npm start`.
6. Added a local SOCKS5 listener with `NO AUTH` + `CONNECT` support.
7. Added a narrow direct transport boundary without routing data-plane through our server.
8. Verified SOCKS5 integration tests and smoke startup/shutdown on loopback.
9. Added Telegram Desktop connect flow with `tg://socks` deep link generation and platform launch fallback.
10. Moved console logs to `stderr` so `connect-url` stays script-friendly on `stdout`.
11. Added Windows launcher wrappers and a reproducible `dist/windows/TG-prox` build script.
12. Verified `dist/windows/TG-prox` build output and runtime `connect-url` from the packaged copy.
13. Added installer-facing Windows metadata and a rendered Inno Setup script alongside the existing launcher entrypoints.
14. Aligned the rendered installer script with per-user install scope in `%LocalAppData%\\Programs\\TG-prox`.
15. Added macOS beta packaging layout and a unified installer build path for Windows and macOS output files.
16. Reclassified script installers as fallback/dev artifacts only, not release outputs.
17. Added Windows standalone packaging scaffolding for a self-contained `.exe` path with bundled runtime expectations.
18. Added macOS `.app -> .pkg` packaging scaffolding with explicit macOS-host requirements.
19. Added a final installer build status flow that records blockers instead of overstating release readiness.
20. Verified that `dist:installers` now writes blocker status on the current Linux host instead of fake release artifacts.
21. Moved script installers to `dist/fallback-installers/` and marked them as fallback/dev-only.
22. Removed overstated installer wording from dev payload metadata in `dist:windows` and `dist:macos`.

Next implementation slice:
1. Tighten the Windows standalone `.exe` path around a vendored runtime and Inno Setup runner.
2. Keep `.pkg` generation explicitly blocked behind a macOS runner until `pkgbuild`/`productbuild` are available.
3. Add branded installer assets once the final `.exe/.pkg` toolchains are available.
