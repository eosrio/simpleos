#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
fi

if [[ -d /opt/homebrew/opt/node@24/bin ]]; then
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
elif [[ -d /usr/local/opt/node@24/bin ]]; then
  export PATH="/usr/local/opt/node@24/bin:$PATH"
fi

case "$(uname -m)" in
  arm64)
    target="aarch64-apple-darwin"
    ;;
  x86_64)
    target="x86_64-apple-darwin"
    ;;
  *)
    echo "Unsupported macOS architecture: $(uname -m)"
    exit 1
    ;;
esac

if ! rustup target list --installed | grep -q "^$target$"; then
  rustup target add "$target"
fi

bunx tauri build \
  --bundles app \
  --target "$target" \
  --features app-store \
  --config src-tauri/tauri.appstore-local.conf.json \
  --config '{"bundle":{"macOS":{"signingIdentity":"-"}}}' \
  --ci
