#!/usr/bin/env node
/**
 * Builds the Microsoft Store package (MSIX) for Windows.
 *
 * Tauri only bundles NSIS and MSI, so this builds the binary with `--no-bundle` and
 * packs it with the Windows SDK's makeappx. The Store build uses the same switches as
 * the Mac App Store build — the `app-store` Cargo feature and the `appstore` Angular
 * configuration — so the self-updater and its UI are left out; the Store delivers
 * updates. The NSIS installer published on GitHub is unaffected.
 *
 * The package is left unsigned: the Store re-signs MSIX packages after certification.
 * To try it locally, register the staged folder instead (docs/windows-store.md).
 *
 * Usage:
 *   node scripts/windows-msstore-package.js [--skip-build]
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TAURI_DIR = path.join(ROOT, 'src-tauri');
const OUT_DIR = path.join(TAURI_DIR, 'target', 'msstore');
const STAGE_DIR = path.join(OUT_DIR, 'stage');
const EXECUTABLE = 'SimplEOS.exe';
// Scale and target-size variants from scripts/windows-msstore-icons.ps1. Windows only
// finds them through resources.pri; without the unplated ones it draws the taskbar
// icon on an accent-coloured plate.
const ASSETS_DIR = path.join(TAURI_DIR, 'msstore', 'assets');

/**
 * MSIX versions are four numbers, each at most 65535, and the last is reserved for the
 * Store and must be 0. The Store serves the highest version, so prereleases share the
 * third field with the patch number and still sort below the release:
 *   2.0.0-alpha.3 -> 2.0.3.0    2.0.0-beta.1 -> 2.0.301.0    2.0.0-rc.2 -> 2.0.602.0
 *   2.0.0         -> 2.0.999.0  2.0.1-alpha.1 -> 2.0.1001.0
 * The app itself still shows the package.json version.
 */
function toMsixVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(version);
  if (!match) {
    throw new Error(`Cannot map "${version}" to an MSIX version (expected x.y.z or x.y.z-alpha|beta|rc.N)`);
  }
  const [, major, minor, patch, stage, n] = match.map((part) => part ?? '');
  const STAGE_BASE = { alpha: 0, beta: 300, rc: 600 };
  let offset = 999;
  if (stage) {
    if (Number(n) > 299) throw new Error(`Prerelease number too large for MSIX mapping: ${version}`);
    offset = STAGE_BASE[stage] + Number(n);
  }
  const build = Number(patch) * 1000 + offset;
  if (Number(major) < 1 || Number(major) > 65535 || Number(minor) > 65535 || build > 65535) {
    throw new Error(`Version ${version} maps outside the MSIX range`);
  }
  return `${Number(major)}.${Number(minor)}.${build}.0`;
}

/** Newest Windows SDK bin directory that has makeappx.exe and makepri.exe. */
function findSdkBin() {
  const kits = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
  const versions = fs.existsSync(kits)
    ? fs
        .readdirSync(kits)
        .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
        .sort((a, b) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < 4; i += 1) if (pa[i] !== pb[i]) return pb[i] - pa[i];
          return 0;
        })
    : [];
  for (const version of versions) {
    const dir = path.join(kits, version, 'x64');
    if (fs.existsSync(path.join(dir, 'makeappx.exe')) && fs.existsSync(path.join(dir, 'makepri.exe'))) return dir;
  }
  return null;
}

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  if (process.platform !== 'win32') {
    console.error('The Microsoft Store package can only be built on Windows.');
    process.exit(1);
  }
  const skipBuild = process.argv.includes('--skip-build');

  const sdkBin = findSdkBin();
  if (!sdkBin) {
    console.error('makeappx.exe not found. Install the Windows 10/11 SDK (it ships with Visual Studio).');
    process.exit(1);
  }

  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const msixVersion = toMsixVersion(version);
  console.log(`App version ${version} -> MSIX version ${msixVersion}\n`);

  if (!skipBuild) {
    // No updater artifacts in this config, so no updater signing key is needed.
    run('bunx', [
      'tauri',
      'build',
      '--no-bundle',
      '--features',
      'app-store',
      '--config',
      'src-tauri/tauri.msstore.conf.json',
    ]);
  }

  const binary = path.join(TAURI_DIR, 'target', 'release', 'simpleos.exe');
  if (!fs.existsSync(binary)) {
    console.error(`Built binary not found: ${binary}`);
    process.exit(1);
  }

  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE_DIR, 'assets'), { recursive: true });
  fs.copyFileSync(binary, path.join(STAGE_DIR, EXECUTABLE));
  for (const asset of fs.readdirSync(ASSETS_DIR)) {
    fs.copyFileSync(path.join(ASSETS_DIR, asset), path.join(STAGE_DIR, 'assets', asset));
  }
  const manifest = fs
    .readFileSync(path.join(TAURI_DIR, 'msstore', 'AppxManifest.xml'), 'utf8')
    .replaceAll('{{VERSION}}', msixVersion);
  if (manifest.includes('{{')) {
    console.error('AppxManifest.xml still has an unfilled {{...}} placeholder.');
    process.exit(1);
  }
  fs.writeFileSync(path.join(STAGE_DIR, 'AppxManifest.xml'), manifest);

  const priConfig = path.join(OUT_DIR, 'priconfig.xml');
  const makepri = path.join(sdkBin, 'makepri.exe');
  run(makepri, ['createconfig', '/cf', priConfig, '/dq', 'en-US', '/pv', '10.0.0', '/o']);
  // The default config splits scale and language variants into separate resource
  // packages, which only an .msixbundle can carry. Keep them all in one resources.pri.
  fs.writeFileSync(
    priConfig,
    fs.readFileSync(priConfig, 'utf8').replace(/\s*<packaging>[\s\S]*?<\/packaging>/, ''),
  );
  run(makepri, [
    'new',
    '/pr',
    STAGE_DIR,
    '/cf',
    priConfig,
    '/mn',
    path.join(STAGE_DIR, 'AppxManifest.xml'),
    '/of',
    path.join(STAGE_DIR, 'resources.pri'),
    '/o',
  ]);

  const msix = path.join(OUT_DIR, `SimplEOS_${version}_x64.msix`);
  run(path.join(sdkBin, 'makeappx.exe'), ['pack', '/o', '/h', 'SHA256', '/d', STAGE_DIR, '/p', msix]);

  console.log(`\nMSIX:   ${msix}`);
  console.log(`Staged: ${STAGE_DIR}`);
  console.log('\nUpload the .msix in Partner Center (SimplEOS Wallet > Packages). See docs/windows-store.md.');
}

if (require.main === module) {
  main();
}

module.exports = { toMsixVersion };
