#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "TG-prox requires Node.js 18 or newer on PATH." >&2
  exit 1
fi

exec node "$SCRIPT_DIR/app/cli.js" connect "$@"
