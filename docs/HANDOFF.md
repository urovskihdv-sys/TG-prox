# Handoff

Status: iteration 10 relay transport and relay server slice complete

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
36. Changed the project decision boundary: data-plane can now go through our server instead of only direct local egress.
37. Added `transport.mode = relay` config support with validated relay server URL, auth token, and optional custom CA path.
38. Added runtime env overrides so packaged or local agents can be switched to relay mode without editing code.
39. Added an HTTPS CONNECT relay transport on the agent side with TLS validation kept enabled.
40. Added a minimal HTTPS relay server process with bearer-token auth and `GET /healthz`.
41. Verified relay mode end-to-end with tests covering `client -> relay server -> target` and unauthorized rejection.
42. Added deploy assets for a known-good real-server path on this host: `systemd` unit plus env-file template for `relay.unitops.pro:8443`.
43. Deployed the relay live on this host at `https://relay.unitops.pro:8443`, issued a Let's Encrypt certificate, opened `8443/tcp`, and verified `/healthz`.
44. Added `GET /config.json` on the live relay server so packaged clients can bootstrap relay settings from the server.
45. Updated both macOS and Windows packaged launchers to default `TGPROX_REMOTE_CONFIG_URL` to `https://relay.unitops.pro:8443/config.json`.
46. Reduced future reinstall churn: after the next installer refresh, relay endpoint/token changes can be served centrally instead of passed manually through Terminal.
47. Restarted the live relay service on this host and verified that `https://relay.unitops.pro:8443/config.json` now returns the packaged client bootstrap config.
48. Found and fixed a relay stability bug where outbound timeouts could crash the whole relay process with an unhandled socket error.
49. Updated the local SOCKS5 adapter to return proper SOCKS failure replies on outbound connect errors instead of silently resetting the client socket.
50. Reduced the relay outbound connect timeout to 4s so failed Telegram probe connections do not stall the user path for 10s.
51. Disabled generic HTTP server keep-alive/request timeouts on the relay service so CONNECT tunnels are not reaped by HTTP-layer idle policies.
52. Enabled tighter TCP keepalive on local SOCKS, relay client sockets, and relay server sockets to detect broken long-lived sessions sooner.

Next implementation slice:
1. Rebuild Windows/macOS installers once more so both platforms pick up the packaged bootstrap URL, then validate them against the live relay without manual env overrides.
2. Validate the new long-lived relay session fix against the live Mac install and confirm Telegram no longer stalls after idle time.
3. Add installer-visible health/status hooks for the background agent instead of relying on logs for diagnosis.
