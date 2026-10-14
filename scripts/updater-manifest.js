#!/usr/bin/env node
/**
 * Builds the Tauri updater manifest (`latest.json`) from the signed artifacts that
 * `tauri build` leaves under `src-tauri/target/**\/release/bundle`.
 *
 * Releases are cut one platform at a time on the machine that can sign for it, so the
 * manifest is assembled incrementally: running this on macOS fills the `darwin-*` keys,
 * running it later on Windows merges the `windows-*` keys into the same file. Platform
 * entries are merged whenever the version matches and discarded when it does not, so a
 * stale entry can never be published alongside a newer build.
 *
 * Usage:
 *   node scripts/updater-manifest.js [--tag v2.0.0-alpha.2] [--notes "..."]
 *                                    [--out dist/updater/latest.json]
 *                                    [--repo eosrio/simpleos] [--bundle-root <dir>]
 *
 * The version comes from package.json — the single source of truth — and the tag
 * defaults to `v<version>`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { verifyUpdaterSignature } = require('./verify-updater-signature');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

/** Every `.sig` next to the artifact it signs, anywhere under the bundle directories. */
function findSignatures(bundleRoot) {
  const found = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.sig')) {
        found.push(full);
      }
    }
  };

  // Host builds land in target/release/bundle; cross and universal builds land in
  // target/<triple>/release/bundle. Both are scanned.
  const targetDir = path.join(bundleRoot, 'src-tauri', 'target');
  walk(path.join(targetDir, 'release', 'bundle'));

  let children;
  try {
    children = fs.readdirSync(targetDir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const child of children) {
    if (!child.isDirectory() || child.name === 'release') continue;
    walk(path.join(targetDir, child.name, 'release', 'bundle'));
  }
  return found;
}

const HOST_ARCH = process.arch === 'arm64' ? 'aarch64' : 'x86_64';

/**
 * Maps an artifact path to the `{os}-{arch}` keys the updater looks up. A universal
 * macOS build answers for both architectures, since Tauri matches on the running arch
 * and has no `darwin-universal` fallback.
 */
function platformKeys(artifactPath) {
  const posix = artifactPath.split(path.sep).join('/');
  const lower = posix.toLowerCase();

  let os;
  if (lower.includes('/macos/') || lower.endsWith('.app.tar.gz')) {
    os = 'darwin';
  } else if (lower.includes('/nsis/') || lower.includes('/msi/') || lower.endsWith('.zip')) {
    os = 'windows';
  } else if (lower.includes('/appimage/') || lower.includes('.appimage')) {
    os = 'linux';
  } else {
    return [];
  }

  const tripleMatch = posix.match(/\/target\/([^/]+)\/release\//);
  const triple = tripleMatch && tripleMatch[1] !== 'release' ? tripleMatch[1] : '';

  if (triple.startsWith('universal')) return [`${os}-aarch64`, `${os}-x86_64`];
  if (triple.includes('aarch64')) return [`${os}-aarch64`];
  if (triple.includes('x86_64')) return [`${os}-x86_64`];
  return [`${os}-${HOST_ARCH}`];
}

/**
 * Extracts the 8-byte minisign key ID from a base64 public key or `.sig` blob. Both
 * decode to a two-line minisign file whose payload is `[2-byte algorithm][8-byte key
 * id][...]`, so the ID identifies which key signed a given artifact.
 */
function keyId(base64Block) {
  try {
    const text = Buffer.from(base64Block.trim(), 'base64').toString('utf8');
    const line = text.split('\n').find((l) => l && !l.startsWith('untrusted comment:'));
    if (!line) return null;
    const bytes = Buffer.from(line.trim(), 'base64');
    return bytes.length >= 10 ? bytes.subarray(2, 10).toString('hex') : null;
  } catch {
    return null;
  }
}

/** The key ID the shipped config trusts, so we can refuse to publish anything else. */
function configuredKeyId() {
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    );
    return keyId(config.plugins?.updater?.pubkey ?? '');
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundleRoot = args['bundle-root'] ? path.resolve(args['bundle-root']) : ROOT;
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = pkg.version;
  const tag = typeof args.tag === 'string' ? args.tag : `v${version}`;
  const repo = typeof args.repo === 'string' ? args.repo : 'eosrio/simpleos';
  const outPath = path.resolve(
    typeof args.out === 'string' ? args.out : path.join(ROOT, 'dist', 'updater', 'latest.json'),
  );

  const signatures = findSignatures(bundleRoot);
  if (signatures.length === 0) {
    console.error(
      'No .sig files found under src-tauri/target/*/release/bundle.\n' +
        'Build with the updater signing key set (TAURI_SIGNING_PRIVATE_KEY or\n' +
        'TAURI_SIGNING_PRIVATE_KEY_PATH) so tauri emits updater artifacts.',
    );
    process.exit(1);
  }

  // Start from the existing manifest so platforms signed on other machines survive,
  // but only when it describes this same version.
  let manifest = { version, notes: '', pub_date: new Date().toISOString(), platforms: {} };
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (existing.version === version) {
        manifest = { ...manifest, ...existing, version, platforms: existing.platforms ?? {} };
      } else {
        console.log(`Existing manifest is ${existing.version}; starting fresh for ${version}.`);
      }
    } catch {
      console.log('Existing manifest could not be parsed; starting fresh.');
    }
  }

  if (typeof args.notes === 'string') manifest.notes = args.notes;
  manifest.pub_date = new Date().toISOString();

  const uploads = new Set();
  for (const sigPath of signatures) {
    const artifactPath = sigPath.slice(0, -'.sig'.length);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`Skipping ${path.basename(sigPath)} — signed artifact is missing.`);
      continue;
    }

    const keys = platformKeys(artifactPath);
    if (keys.length === 0) {
      console.warn(`Skipping ${path.basename(artifactPath)} — not an updater artifact.`);
      continue;
    }

    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
    verifyUpdaterSignature(fs.readFileSync(artifactPath), config.plugins?.updater?.pubkey ?? '', signature);

    // A self-test build leaves artifacts signed by a throwaway key in the same target
    // directory. Publishing those would advertise updates no installed app can verify,
    // so refuse them here rather than discover it after the manifest is live.
    const expectedKey = configuredKeyId();
    const signedBy = keyId(signature);
    if (expectedKey && signedBy && signedBy !== expectedKey) {
      console.error(
        `\n${path.basename(artifactPath)} was signed by key ${signedBy}, but the app trusts ` +
          `${expectedKey}.\nThis is what a leftover self-test build looks like. Delete ` +
          'src-tauri/target/*/release/bundle\nand rebuild with the release signing key.',
      );
      process.exit(1);
    }

    const url = `https://github.com/${repo}/releases/download/${tag}/${path.basename(artifactPath)}`;

    for (const key of keys) {
      manifest.platforms[key] = { signature, url };
      console.log(`${key} -> ${path.basename(artifactPath)}`);
    }

    uploads.add(artifactPath);
    uploads.add(sigPath);
  }

  if (Object.keys(manifest.platforms).length === 0) {
    console.error('No updater artifacts were matched; refusing to write an empty manifest.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nManifest: ${outPath}`);
  console.log(`Version:  ${manifest.version} (tag ${tag})`);
  console.log('Artifacts to upload:');
  for (const file of [...uploads].sort()) {
    console.log(`  ${path.relative(bundleRoot, file)}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findSignatures, platformKeys, parseArgs, ROOT };
