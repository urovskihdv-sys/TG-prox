TG-prox Windows standalone package payload

This payload is intended for an installer-built .exe package.

Notes:
- Node.js is bundled inside runtime/node/node.exe and is not required on the user machine.
- TG-prox-background.vbs is the hidden launcher used for post-install start and Windows autostart.
- TG-prox.cmd remains a visible CLI fallback for manual connect runs.
- TG-prox-connect-url.cmd prints the tg://socks deep link.
- The installer registers a per-user Run entry so the local SOCKS5 listener starts again after login.
- TG-prox-standalone.iss is the Inno Setup script used to build the final .exe installer.
