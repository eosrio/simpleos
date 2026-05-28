#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

lane="appstore-local"
open_app=0
source_app=""
install_dir="${LOCAL_APPS_DIR:-$HOME/Applications}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --appstore)
      lane="appstore-local"
      shift
      ;;
    --appstore-local)
      lane="appstore-local"
      shift
      ;;
    --appstore-upload)
      lane="appstore-upload"
      shift
      ;;
    --direct)
      lane="direct"
      shift
      ;;
    --source)
      source_app="${2:?missing value for --source}"
      shift 2
      ;;
    --install-dir)
      install_dir="${2:?missing value for --install-dir}"
      shift 2
      ;;
    --open)
      open_app=1
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Local macOS app install must run on macOS."
  exit 1
fi

find_app() {
  case "$(uname -m)" in
    arm64)
      host_target="aarch64-apple-darwin"
      ;;
    x86_64)
      host_target="x86_64-apple-darwin"
      ;;
    *)
      host_target=""
      ;;
  esac

  case "$lane" in
    appstore-local)
      for candidate in \
        "src-tauri/target/$host_target/release/bundle/macos/SimplEOS.app" \
        "src-tauri/target/release/bundle/macos/SimplEOS.app"; do
        if [[ -n "$host_target" && -d "$candidate" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
      done
      ;;
    appstore-upload)
      for candidate in \
        "src-tauri/target/universal-apple-darwin/release/bundle/macos/SimplEOS.app" \
        "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/SimplEOS.app" \
        "src-tauri/target/release/bundle/macos/SimplEOS.app"; do
        if [[ -d "$candidate" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
      done
      ;;
    direct)
      for candidate in \
        "src-tauri/target/universal-apple-darwin/release/bundle/macos/SimplEOS.app" \
        "src-tauri/target/release/bundle/macos/SimplEOS.app" \
        "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/SimplEOS.app"; do
        if [[ -d "$candidate" ]]; then
          printf '%s\n' "$candidate"
          return 0
        fi
      done
      ;;
  esac
  return 1
}

if [[ -z "$source_app" ]]; then
  source_app="$(find_app || true)"
fi

if [[ -z "$source_app" || ! -d "$source_app" ]]; then
  echo "Could not find a built SimplEOS.app bundle."
  echo "Build it first with: bun run tauri:build:mac:appstore:local"
  exit 1
fi

mkdir -p "$install_dir"
dest_app="$install_dir/SimplEOS.app"

if [[ -d "$dest_app" ]]; then
  rm -rf "$dest_app"
fi

/usr/bin/ditto "$source_app" "$dest_app"
codesign --verify --deep --strict --verbose=2 "$dest_app"

if [[ "$lane" == appstore-* ]]; then
  entitlements_plist="$(mktemp)"
  trap 'rm -f "$entitlements_plist"' EXIT
  codesign -d --entitlements :- "$dest_app" >"$entitlements_plist" 2>/dev/null

  sandbox_value="$(/usr/libexec/PlistBuddy -c 'Print :com.apple.security.app-sandbox' "$entitlements_plist" 2>/dev/null || true)"
  app_identifier="$(/usr/libexec/PlistBuddy -c 'Print :com.apple.application-identifier' "$entitlements_plist" 2>/dev/null || true)"

  if [[ "$sandbox_value" != "true" ]]; then
    echo "The installed app does not look like a sandboxed App Store build."
    echo "Rebuild it first with: bun run tauri:build:mac:appstore:local"
    exit 1
  fi

  if [[ "$lane" == "appstore-upload" && "$app_identifier" != "FS7QM58848.io.eosrio.simpleos" ]]; then
    echo "The installed app does not look like the signed App Store upload build."
    echo "Rebuild it first with: bun run tauri:build:mac:appstore"
    exit 1
  fi

  signing_authority="$(codesign -dv --verbose=4 "$dest_app" 2>&1 | awk -F= '/^Authority=/ { print $2; exit }')"
  if [[ "$lane" == "appstore-local" && "$signing_authority" == Apple\ Distribution:* ]]; then
    echo "The selected app is signed for App Store upload and macOS will not launch it directly."
    echo "Rebuild the local test app first with: bun run tauri:build:mac:appstore:local"
    exit 1
  fi
fi

echo "Installed SimplEOS.app:"
echo "$dest_app"

if [[ "$open_app" -eq 1 ]]; then
  open -n "$dest_app"
fi
