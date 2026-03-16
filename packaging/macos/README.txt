TG-prox macOS beta package

Primary installed assets:
- /Applications/TG-prox.app: app bundle used for manual connect actions.
- /Library/LaunchAgents/local.tgprox.agent.plist: keeps the local SOCKS5 agent running in background.

Requirements:
- Telegram Desktop installed with the tg:// protocol handler registered

Notes:
- The control plane is HTTPS remote config only.
- Data-plane can run either direct or through the HTTPS relay transport, depending on config.
- The packaged app bootstraps remote config from https://relay.unitops.pro:8443/config.json unless overridden.
- Runtime data defaults to ~/Library/Application Support/TG-prox on macOS.
- The pkg should leave TG-prox running through launchd after install and after login.
- The installer also attempts one immediate app launch so Telegram can register the local proxy without Terminal.
