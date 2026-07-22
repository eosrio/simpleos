#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bundles="app,dmg"
extra_args=()
require_updater_key=1
target_triple=""
notary_profile="${APPLE_NOTARY_KEYCHAIN_PROFILE:-agent-portal-notary}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --universal)
      target_triple="universal-apple-darwin"
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
    --notary-profile)
      notary_profile="${2:?missing value for --notary-profile}"
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
  APPLE_SIGNING_IDENTITY="$(
    security find-identity -v -p codesigning \
      | sed -n 's/.*"\(Developer ID Application:.*\)"/\1/p' \
      | head -n 1
  )"
  if [[ -z "$APPLE_SIGNING_IDENTITY" ]]; then
    echo "No Developer ID Application signing identity was found."
    echo "Install the certificate in Keychain Access or export APPLE_SIGNING_IDENTITY."
    exit 1
  fi
  export APPLE_SIGNING_IDENTITY
fi

if ! xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null; then
  echo "The notarytool Keychain profile '$notary_profile' is unavailable or invalid."
  echo "Create it once with 'xcrun notarytool store-credentials' or select another profile with --notary-profile."
  exit 1
fi

if [[ "$require_updater_key" -eq 1 ]]; then
  if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]]; then
    echo "Updater signing key is not configured."
    echo "Set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH, or pass --no-updater."
    exit 1
  fi
fi

# Notarization is performed below with a Keychain profile. Ensure Tauri cannot
# accidentally switch to an environment-provided plaintext/API credential flow.
build_args=(run tauri build --bundles "$bundles")
if [[ -n "$target_triple" ]]; then
  build_args+=(--target "$target_triple")
fi
build_args+=("${extra_args[@]+"${extra_args[@]}"}")

env \
  -u APPLE_ID \
  -u APPLE_PASSWORD \
  -u APPLE_TEAM_ID \
  -u APPLE_API_ISSUER \
  -u APPLE_API_KEY \
  -u APPLE_API_KEY_PATH \
  -u API_PRIVATE_KEYS_DIR \
  bun "${build_args[@]}"

if [[ -n "$target_triple" ]]; then
  bundle_dir="src-tauri/target/$target_triple/release/bundle"
else
  bundle_dir="src-tauri/target/release/bundle"
fi

has_bundle() {
  [[ ",$bundles," == *",$1,"* ]]
}

if has_bundle app || has_bundle dmg; then
  app_path="$bundle_dir/macos/SimplEOS.app"
  if [[ ! -d "$app_path" ]]; then
    echo "Signed app bundle was not produced at $app_path."
    exit 1
  fi

  notary_temp_dir="$(mktemp -d)"
  trap 'rm -rf "$notary_temp_dir"' EXIT
  app_zip="$notary_temp_dir/SimplEOS.zip"
  ditto -c -k --keepParent "$app_path" "$app_zip"
  xcrun notarytool submit "$app_zip" \
    --keychain-profile "$notary_profile" \
    --wait
  xcrun stapler staple "$app_path"
  xcrun stapler validate "$app_path"
  codesign --verify --strict --verbose=2 "$app_path"
  spctl --assess --type execute --verbose=4 "$app_path"
fi

if has_bundle dmg; then
  dmg_dir="$bundle_dir/dmg"
  app_version="$(
    sed -n 's/^[[:space:]]*"version": "\([^"]*\)",/\1/p' src-tauri/tauri.conf.json \
      | head -n 1
  )"
  if [[ -z "$app_version" ]]; then
    echo "Unable to read the app version from src-tauri/tauri.conf.json."
    exit 1
  fi
  shopt -s nullglob
  dmg_files=("$dmg_dir/SimplEOS_${app_version}_"*.dmg)
  shopt -u nullglob
  if [[ "${#dmg_files[@]}" -ne 1 ]]; then
    echo "Expected exactly one SimplEOS $app_version DMG in $dmg_dir; found ${#dmg_files[@]}."
    exit 1
  fi
  dmg_path="${dmg_files[0]}"
  xcrun notarytool submit "$dmg_path" \
    --keychain-profile "$notary_profile" \
    --wait
  xcrun stapler staple "$dmg_path"
  xcrun stapler validate "$dmg_path"
  spctl --assess --type open --context context:primary-signature --verbose=4 "$dmg_path"
fi
