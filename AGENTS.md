# AGENTS.md

Project: TG-prox

Scope:
- Separate Windows-first MVP desktop/local-agent project.
- Do not mix with clinic analytics project.
- Prioritize working Windows build over refactoring.
- macOS is best-effort beta.

Rules:
- Reuse ideas from tg-ws-proxy, but keep this repo isolated.
- Keep TLS validation enabled; never disable hostname/cert verification.
- Never log payloads or message contents.
- Prefer small, vertical slices that end in a runnable state.
