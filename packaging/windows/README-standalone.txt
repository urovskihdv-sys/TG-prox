TG-prox Windows standalone package payload

This payload is intended for an installer-built .exe package.

Notes:
- Node.js is bundled inside runtime/node/node.exe and is not required on the user machine.
- TG-prox.cmd is the primary launcher.
- TG-prox-connect-url.cmd prints the tg://socks deep link.
- TG-prox-standalone.iss is the Inno Setup script used to build the final .exe installer.
