#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bundles="app,dmg"
target_args=()
extra_args=()
require_updater_key=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universal)
      target_args=(--target universal-apple-darwin)
      shift
      ;;
    --no-updater)
      require_updater_key=0
      extra_args+=(--config '{"bundle":{"createUpdaterArtifacts":false}}')
      shift
      ;;
    --bundles)
      bundles="${2:?missing value for --bundles}"
      shift 2
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS packaging must run on macOS."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode Command Line Tools are required. Install them with: xcode-select --install"
  exit 1
fi

if ! xcrun notarytool --version >/dev/null 2>&1; then
  echo "notarytool is required. Install or select a current Xcode/Command Line Tools setup."
  exit 1
fi

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  if ! security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    echo "No Developer ID Application signing identity was found."
    echo "Install the certificate in Keychain Access or export APPLE_SIGNING_IDENTITY."
    exit 1
  fi
fi

has_apple_id=0
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_apple_id=1
fi

has_api_key=0
if [[ -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY:-}" ]]; then
  if [[ -n "${APPLE_API_KEY_PATH:-}" || -n "${API_PRIVATE_KEYS_DIR:-}" ]]; then
    has_api_key=1
  fi
fi

if [[ "$has_apple_id" -ne 1 && "$has_api_key" -ne 1 ]]; then
  echo "Notarization credentials are not configured."
  echo "Set APPLE_API_ISSUER/APPLE_API_KEY/APPLE_API_KEY_PATH or APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID."
  exit 1
fi

if [[ "$require_updater_key" -eq 1 ]]; then
  if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]]; then
    echo "Updater signing key is not configured."
    echo "Set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH, or pass --no-updater."
    exit 1
  fi
fi

exec bun run tauri build --bundles "$bundles" "${target_args[@]}" "${extra_args[@]}"
