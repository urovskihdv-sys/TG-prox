# Product Brief

Name: TG-prox
Goal: local desktop app that starts a localhost SOCKS5 proxy and connects Telegram Desktop in one click.

Current architecture decision:
- Separate project in /opt/TG-prox
- Windows first
- Server used as control plane (remote config over HTTPS)
- Relay/data-plane through our server is now enabled as the next implementation path for real Telegram bypass
