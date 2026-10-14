#!/usr/bin/env node
/**
 * Rehearses the update flow end to end on the local machine — no production signing
 * key, no GitHub, nothing published.
 *
 * It works by building the app against a throwaway keypair and a `localhost` endpoint,
 * then serving a manifest that advertises a higher version than the build reports. The
 * running app therefore sees an update, downloads it, verifies the signature against
 * the throwaway public key, installs and relaunches.
 *
 *   node scripts/updater-selftest.js prepare   # make a test key + build config
 *   node scripts/updater-selftest.js serve     # serve the manifest for the built app
 *
 * Because the "update" is the same build, the relaunched app reports the old version
 * and will offer the update again. That is expected: this exercises discovery,
 * download, signature verification and install — not the version bump itself. For a
 * true upgrade, build twice with different `package.json` versions and serve the newer
 * one.
 *
 * Everything lives in .updater-selftest/ (gitignored) and is safe to delete.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findSignatures, platformKeys, ROOT } = require('./updater-manifest.js');

const WORK_DIR = path.join(ROOT, '.updater-selftest');
const KEY_PATH = path.join(WORK_DIR, 'test.key');
const OVERRIDE_PATH = path.join(WORK_DIR, 'override.json');
const PORT = Number(process.env.UPDATER_SELFTEST_PORT ?? 4599);

/** Bumps the trailing number so the served manifest outranks the build. */
function advertisedVersion(version) {
  const prerelease = version.match(/^(.*?)(\d+)$/);
  if (prerelease) return `${prerelease[1]}${Number(prerelease[2]) + 1}`;
  return `${version}-selftest.1`;
}

function prepare() {
  fs.mkdirSync(WORK_DIR, { recursive: true });

  if (!fs.existsSync(`${KEY_PATH}.pub`)) {
    console.log('Generating a throwaway updater keypair...');
    const result = spawnSync('bunx', ['tauri', 'signer', 'generate', '-w', KEY_PATH, '-p', ''], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  const pubkey = fs.readFileSync(`${KEY_PATH}.pub`, 'utf8').trim();
  fs.writeFileSync(
    OVERRIDE_PATH,
    `${JSON.stringify(
      {
        plugins: {
          updater: {
            pubkey,
            endpoints: [`http://localhost:${PORT}/latest.json`],
            // The plugin panics at startup on a non-HTTPS endpoint. This opt-out exists
            // only in this generated override, never in the shipped tauri.conf.json, so
            // it cannot reach a real build.
            dangerousInsecureTransportProtocol: true,
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  // Build through the packaging wrapper: `tauri build` itself only reads
  // TAURI_SIGNING_PRIVATE_KEY (the _PATH variant is ignored and the bundle fails at
  // the very end), and the wrapper normalises that for us.
  // The generated key has no password; export an empty one so Tauri does not stop to
  // prompt on stdin at the very end of the build.
  const setKey =
    process.platform === 'win32'
      ? `$env:TAURI_SIGNING_PRIVATE_KEY_PATH="${KEY_PATH}"; $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`
      : `export TAURI_SIGNING_PRIVATE_KEY_PATH="${KEY_PATH}" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`;

  console.log(`\nWrote ${path.relative(ROOT, OVERRIDE_PATH)}\n`);
  console.log('Now build against it:\n');
  console.log(`  ${setKey}`);
  console.log(`  bun run tauri:build -- --config ${path.relative(ROOT, OVERRIDE_PATH)}\n`);
  console.log('Then run the build (installed or straight from');
  console.log('src-tauri/target/release/) and start the server:\n');
  console.log('  node scripts/updater-selftest.js serve');
}

function serve() {
  if (!fs.existsSync(`${KEY_PATH}.pub`)) {
    console.error('Run `node scripts/updater-selftest.js prepare` and build first.');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = advertisedVersion(pkg.version);

  const files = new Map();
  const platforms = {};
  for (const sigPath of findSignatures(ROOT)) {
    const artifactPath = sigPath.slice(0, -'.sig'.length);
    if (!fs.existsSync(artifactPath)) continue;
    const keys = platformKeys(artifactPath);
    if (keys.length === 0) continue;

    const name = path.basename(artifactPath);
    files.set(name, artifactPath);
    for (const key of keys) {
      platforms[key] = {
        signature: fs.readFileSync(sigPath, 'utf8').trim(),
        url: `http://localhost:${PORT}/${encodeURIComponent(name)}`,
      };
    }
  }

  if (Object.keys(platforms).length === 0) {
    console.error(
      'No signed updater artifacts found. Build with the test key first:\n' +
        '  node scripts/updater-selftest.js prepare',
    );
    process.exit(1);
  }

  const manifest = {
    version,
    notes: 'Local updater self-test build.',
    pub_date: new Date().toISOString(),
    platforms,
  };

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\//, '');

    if (url === 'latest.json') {
      console.log(`  ${req.method} /latest.json -> advertising ${version}`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(manifest, null, 2));
      return;
    }

    const artifact = files.get(url);
    if (artifact) {
      console.log(`  ${req.method} /${url} -> ${artifact}`);
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': fs.statSync(artifact).size,
      });
      fs.createReadStream(artifact).pipe(res);
      return;
    }

    res.writeHead(404).end('not found');
  });

  server.listen(PORT, () => {
    console.log(`Serving the self-test manifest on http://localhost:${PORT}/latest.json`);
    console.log(`Advertising ${version} (installed build reports ${pkg.version})`);
    console.log('Platforms:');
    for (const [key, entry] of Object.entries(platforms)) {
      console.log(`  ${key} -> ${path.basename(new URL(entry.url).pathname)}`);
    }
    console.log('\nLaunch the app built with the self-test config. It should show');
    console.log('"Update ready" in the sidebar. Ctrl+C to stop.\n');
  });
}

const command = process.argv[2] ?? 'prepare';
if (command === 'prepare') prepare();
else if (command === 'serve') serve();
else {
  console.error(`Unknown command '${command}'. Use: prepare | serve`);
  process.exit(1);
}
