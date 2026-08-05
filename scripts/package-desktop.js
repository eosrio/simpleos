#!/usr/bin/env node
/**
 * Builds the desktop bundles for the host platform. This is the entry point for a
 * plain build from source on any OS; signed and notarized macOS *releases* go through
 * `scripts/macos-package.sh`, which this script points you at.
 *
 * The important behaviour here is what happens without the updater signing key.
 * `tauri.conf.json` pins an updater public key, and Tauri refuses to bundle when it
 * finds a public key with no private key to match — which would make the repo
 * unbuildable for anyone who is not cutting a release. When no key is configured this
 * script passes `--no-sign`, so a source build succeeds and produces a working app.
 *
 * A source-built app still receives updates: verification uses the *public* key baked
 * into the config, so any build from this repo trusts the same official releases. It
 * just cannot itself be published as an update, since nothing signed its artifacts.
 *
 * Usage:
 *   node scripts/package-desktop.js [--bundles nsis] [--no-updater] [--target <triple>]
 *                                   [-- <extra tauri args>]
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const DEFAULT_BUNDLES = {
  win32: 'nsis',
  linux: 'appimage,deb',
  darwin: 'app,dmg',
};

function main() {
  const argv = process.argv.slice(2);
  const platform = process.platform;

  if (!DEFAULT_BUNDLES[platform]) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  if (platform === 'darwin') {
    console.log(
      'Building an unnotarized local bundle. Releases for distribution go through\n' +
        'scripts/macos-package.sh (bun run tauri:build:mac:universal), which signs,\n' +
        'notarizes and staples.\n',
    );
  }

  let bundles = DEFAULT_BUNDLES[platform];
  let target = '';
  let skipUpdater = false;
  const passthrough = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bundles') {
      bundles = argv[i + 1];
      i += 1;
    } else if (arg === '--target') {
      target = argv[i + 1];
      i += 1;
    } else if (arg === '--no-updater') {
      skipUpdater = true;
    } else if (arg === '--') {
      passthrough.push(...argv.slice(i + 1));
      break;
    } else {
      passthrough.push(arg);
    }
  }

  // `tauri build` only reads TAURI_SIGNING_PRIVATE_KEY; TAURI_SIGNING_PRIVATE_KEY_PATH
  // is honoured by `tauri signer sign` but silently ignored here, which fails the
  // bundle with "a public key has been found, but no private key". Accept either and
  // normalise, so exporting the path — what the packaging docs describe — works.
  const env = { ...process.env };
  if (!env.TAURI_SIGNING_PRIVATE_KEY && env.TAURI_SIGNING_PRIVATE_KEY_PATH) {
    const keyPath = env.TAURI_SIGNING_PRIVATE_KEY_PATH;
    if (!fs.existsSync(keyPath)) {
      console.error(`TAURI_SIGNING_PRIVATE_KEY_PATH points at a missing file: ${keyPath}`);
      process.exit(1);
    }
    env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyPath, 'utf8').trim();
  }

  const hasSigningKey = Boolean(env.TAURI_SIGNING_PRIVATE_KEY);

  // With a key but no password variable, Tauri prompts on stdin — which hangs forever
  // in CI or any non-interactive shell, after the whole release build has completed.
  if (hasSigningKey && env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
    console.log(
      'TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set — Tauri will prompt for the key\n' +
        'password when signing. Export it (empty string for a password-less key) to\n' +
        'keep the build non-interactive.\n',
    );
  }

  const args = ['tauri', 'build', '--bundles', bundles];
  if (target) args.push('--target', target);

  if (skipUpdater) {
    // Explicitly asked for a build with no updater artifacts at all.
    args.push('--config', JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
    args.push('--no-sign');
    console.log('Updater artifacts disabled (--no-updater).');
  } else if (!hasSigningKey) {
    args.push('--no-sign');
    console.log(
      'No updater signing key found — building unsigned (--no-sign).\n' +
        'The app still checks for and verifies official updates; it just cannot be\n' +
        'published as one. To cut a release, set TAURI_SIGNING_PRIVATE_KEY_PATH first.\n',
    );
  } else {
    console.log('Updater signing key found — updater artifacts will be signed.\n');
  }

  args.push(...passthrough);

  console.log(`> bunx ${args.join(' ')}\n`);
  // No `shell: true` — it concatenates rather than escapes arguments, which breaks on
  // paths with spaces and trips Node's DEP0190 warning. bunx resolves as bunx.exe.
  const result = spawnSync('bunx', args, {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const bundleDir = path.join(
    ROOT,
    'src-tauri',
    'target',
    ...(target ? [target] : []),
    'release',
    'bundle',
  );

  console.log(`\nBundles: ${bundleDir}`);
  listBundles(bundleDir);

  if (!skipUpdater && hasSigningKey) {
    console.log('\nNext: bun run updater:manifest   (then updater:publish)');
  }
}

function listBundles(dir) {
  const walk = (current, depth = 0) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else {
        console.log(`  ${path.relative(dir, full)}`);
      }
    }
  };
  walk(dir);
}

main();
