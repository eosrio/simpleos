#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.appstore ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.appstore
  set +a
fi

export APPLE_TEAM_ID="${APPLE_TEAM_ID:-FS7QM58848}"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
fi

if [[ -d /opt/homebrew/opt/node@24/bin ]]; then
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
elif [[ -d /usr/local/opt/node@24/bin ]]; then
  export PATH="/usr/local/opt/node@24/bin:$PATH"
fi

upload=0
validate=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload)
      upload=1
      validate=1
      shift
      ;;
    --validate)
      validate=1
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

find_identity() {
  local policy="$1"
  local pattern="$2"
  security find-identity -v -p "$policy" | awk -F '"' -v pattern="$pattern" '$0 ~ pattern { print $2; exit }'
}

APPSTORE_APP_SIGNING_IDENTITY="${APPSTORE_APP_SIGNING_IDENTITY:-$(find_identity codesigning '3rd Party Mac Developer Application|Apple Distribution')}"
APPSTORE_INSTALLER_SIGNING_IDENTITY="${APPSTORE_INSTALLER_SIGNING_IDENTITY:-$(find_identity basic '3rd Party Mac Developer Installer|Mac Installer Distribution')}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Mac App Store packaging must run on macOS."
  exit 1
fi

if ! command -v productbuild >/dev/null 2>&1; then
  echo "productbuild is required. Install/select Xcode Command Line Tools."
  exit 1
fi

if [[ -z "${APPSTORE_PROVISIONING_PROFILE:-}" || ! -f "$APPSTORE_PROVISIONING_PROFILE" ]]; then
  echo "Set APPSTORE_PROVISIONING_PROFILE to the Mac App Store provisioning profile for io.eosrio.simpleos."
  exit 1
fi

if [[ -z "$APPSTORE_APP_SIGNING_IDENTITY" ]]; then
  echo "No Mac App Store application signing identity was found."
  echo "Set APPSTORE_APP_SIGNING_IDENTITY or install a Mac App Distribution certificate."
  exit 1
fi

if [[ -z "$APPSTORE_INSTALLER_SIGNING_IDENTITY" ]]; then
  echo "No Mac App Store installer signing identity was found."
  echo "Set APPSTORE_INSTALLER_SIGNING_IDENTITY or install a Mac Installer Distribution certificate."
  exit 1
fi

if ! rustup target list --installed | grep -q '^x86_64-apple-darwin$'; then
  rustup target add x86_64-apple-darwin
fi

cp "$APPSTORE_PROVISIONING_PROFILE" src-tauri/embedded.provisionprofile
trap 'rm -f src-tauri/embedded.provisionprofile' EXIT

bunx tauri build \
  --bundles app \
  --target universal-apple-darwin \
  --features app-store \
  --config src-tauri/tauri.appstore.conf.json \
  --config "{\"bundle\":{\"macOS\":{\"signingIdentity\":\"$APPSTORE_APP_SIGNING_IDENTITY\"}}}" \
  --ci

app_path="src-tauri/target/universal-apple-darwin/release/bundle/macos/SimplEOS.app"
if [[ ! -d "$app_path" ]]; then
  app_path="$(find src-tauri/target -path '*/release/bundle/macos/SimplEOS.app' -type d | head -1)"
fi

if [[ -z "$app_path" || ! -d "$app_path" ]]; then
  echo "Could not find the built SimplEOS.app bundle."
  exit 1
fi

pkg_dir="src-tauri/target/universal-apple-darwin/release/bundle/pkg"
mkdir -p "$pkg_dir"
appstore_version="$(node - <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('src-tauri/tauri.appstore.conf.json', 'utf8'));
const version = config.version || require('./package.json').version;
const releaseVersion = String(version).match(/^\d+\.\d+\.\d+/)?.[0];
if (!releaseVersion) {
  throw new Error(`Invalid Mac App Store version: ${version}`);
}
process.stdout.write(releaseVersion);
NODE
)"
pkg_path="$pkg_dir/SimplEOS_${appstore_version}_universal_appstore.pkg"

productbuild \
  --component "$app_path" /Applications \
  --sign "$APPSTORE_INSTALLER_SIGNING_IDENTITY" \
  "$pkg_path"

codesign --verify --deep --strict --verbose=2 "$app_path"
pkgutil --check-signature "$pkg_path"

altool_auth_args=()
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  altool_auth_args+=(--api-key "$APPLE_API_KEY" --api-issuer "$APPLE_API_ISSUER")
  if [[ -n "${APPLE_API_KEY_PATH:-}" ]]; then
    altool_auth_args+=(--p8-file-path "$APPLE_API_KEY_PATH")
  fi
elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" ]]; then
  altool_auth_args+=(-u "$APPLE_ID" -p "$APPLE_PASSWORD")
else
  altool_auth_args=()
fi

if [[ -n "${APPLE_PROVIDER_PUBLIC_ID:-}" ]]; then
  altool_auth_args+=(--provider-public-id "$APPLE_PROVIDER_PUBLIC_ID")
fi

if [[ "$validate" -eq 1 || "$upload" -eq 1 ]]; then
  if ! xcrun altool --help >/dev/null 2>&1; then
    echo "xcrun altool is required for App Store validation/upload. Install/select full Xcode."
    exit 1
  fi

  if [[ "${#altool_auth_args[@]}" -eq 0 ]]; then
    echo "Set APPLE_API_KEY/APPLE_API_ISSUER or APPLE_ID/APPLE_PASSWORD to validate or upload."
    exit 1
  fi
fi

if [[ "$validate" -eq 1 ]]; then
  xcrun altool --validate-app "$pkg_path" "${altool_auth_args[@]}"
fi

if [[ "$upload" -eq 1 ]]; then
  xcrun altool --upload-package "$pkg_path" "${altool_auth_args[@]}"
fi

echo "Mac App Store package ready:"
echo "$pkg_path"
