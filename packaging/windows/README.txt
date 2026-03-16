TG-prox Windows MVP package

Primary launchers:
- TG-prox.cmd: starts the local SOCKS5 agent and triggers Telegram connect flow.
- TG-prox-connect-url.cmd: prints the tg://socks deep link without opening Telegram.
- TG-prox.ps1: PowerShell wrapper with modes connect, serve, connect-url.

Requirements:
- Node.js 18 or newer installed and available on PATH
- Telegram Desktop installed with the tg:// protocol handler registered

Notes:
- The control plane is HTTPS remote config only.
- Data-plane is direct outbound TCP in this MVP slice.
- Runtime data defaults to %APPDATA%\TG-prox on Windows.
