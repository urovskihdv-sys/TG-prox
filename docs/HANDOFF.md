# Handoff

Status: iteration 9 windows background install path complete

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
23. Added a GitHub Actions workflow that can build Windows `.exe` and macOS `.pkg` on hosted runners with minimal manual setup.
24. Fixed the macOS hosted-runner packaging path so `.pkg` artifacts are produced successfully on GitHub Actions.
25. Validated the hosted workflow end-to-end on the real GitHub repository and downloaded both Windows `.exe` and macOS `.pkg` artifacts.
26. Confirmed the macOS `.pkg` installs, but also confirmed the first package version only worked while TG-prox stayed open in Terminal.
27. Added a macOS `launchd` LaunchAgent packaging path so the local SOCKS5 listener runs in background after install and after login.
28. Updated macOS postinstall to bootstrap the LaunchAgent immediately and trigger one app launch for Telegram proxy registration without Terminal.
29. Updated `connect` mode to reuse an already-running local SOCKS5 listener and exit cleanly instead of leaving an extra hanging process.
30. Added runtime reachability tests for the listener probe used by the connect-flow reuse path.
31. Added a hidden Windows background launcher based on `wscript.exe` for the standalone installer payload.
32. Updated the Windows `.exe` installer to register a per-user `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry for autostart after login.
33. Switched the Windows post-install launch path to the hidden background launcher so the installer no longer depends on a visible console staying open.
34. Updated Windows standalone metadata and README notes to describe the new persistent background behavior honestly.
35. Fixed the macOS app-bundle launcher so `LaunchAgent` runs `serve` without accidentally prepending `connect` and re-triggering repeated Telegram proxy prompts.

Next implementation slice:
1. Rebuild and validate the macOS `.pkg` after the launcher-argument fix so the install path triggers Telegram once but leaves background `serve` quiet afterward.
2. Validate the new Windows autostart path on the hosted runner artifact and confirm the installed app survives logout/login without a visible console.
3. Add installer-visible health/status hooks for the background agent instead of relying on logs for diagnosis.
