TG-prox macOS beta package

Primary launchers:
- TG-prox.command: starts the local SOCKS5 agent and triggers Telegram connect flow.
- TG-prox-connect-url.command: prints the tg://socks deep link without opening Telegram.

Requirements:
- Node.js 18 or newer installed and available on PATH
- Telegram Desktop installed with the tg:// protocol handler registered

Notes:
- The control plane is HTTPS remote config only.
- Data-plane is direct outbound TCP in this MVP slice.
- Runtime data defaults to ~/Library/Application Support/TG-prox on macOS.
- INSTALLER-METADATA.json describes install scope, entrypoints, and prerequisites.
