#!/usr/bin/env bash
set -euo pipefail

if [[ -d /opt/homebrew/opt/node@24/bin ]]; then
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
elif [[ -d /usr/local/opt/node@24/bin ]]; then
  export PATH="/usr/local/opt/node@24/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 24 with: brew install node@24"
  exit 1
fi

exec "$@"
