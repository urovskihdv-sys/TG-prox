# TG-prox

Windows-first MVP for a local Telegram proxy agent.

## Current slice

The repository now contains a runnable local-agent bootstrap focused on the control-plane path:

- config/model normalization
- remote config loader over HTTPS
- cache fallback on fetch failure
- bundled default fallback when cache is missing
- file + stdout logging without payload logging
- local SOCKS5 adapter with `CONNECT` support and direct outbound transport

This is intentionally a vertical slice for the MVP foundation. No relay/data-plane is routed through our server in this phase.

## Runtime

- Node.js 18+
- No external dependencies yet

## Run

```bash
npm start
```

This starts a long-running local agent and binds the SOCKS5 listener from the resolved config. Current default is `127.0.0.1:9150`.

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

## Test

```bash
npm test
```

## Windows-first note

The runtime path layout already prefers `%APPDATA%\\TG-prox` on Windows. macOS remains best-effort beta. On Linux/dev, the default runtime directory is repo-local `runtime/` so the bootstrap runs without extra setup.
