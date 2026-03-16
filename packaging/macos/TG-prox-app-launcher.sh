#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NODE_BIN="$APP_ROOT/Frameworks/node/bin/node"
CLI_JS="$APP_ROOT/Resources/app/cli.js"
DEFAULT_REMOTE_CONFIG_URL="https://relay.unitops.pro:8443/config.json"

if [[ ! -x "$NODE_BIN" ]]; then
  echo "TG-prox bundled Node runtime is missing." >&2
  exit 1
fi

export TGPROX_REMOTE_CONFIG_URL="${TGPROX_REMOTE_CONFIG_URL:-$DEFAULT_REMOTE_CONFIG_URL}"

if [[ "$#" -gt 0 ]]; then
  exec "$NODE_BIN" "$CLI_JS" "$@"
fi

exec "$NODE_BIN" "$CLI_JS" connect
