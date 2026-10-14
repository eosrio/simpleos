#!/usr/bin/env node
/**
 * Publishes an update: uploads the signed updater artifacts to the GitHub release for
 * the tag, then writes `latest.json` to the `updater` branch — the stable URL the app
 * polls (`tauri.conf.json > plugins > updater > endpoints`).
 *
 * The manifest lives on a branch rather than as a release asset because GitHub's
 * `releases/latest/` only ever resolves to the newest *non-prerelease*. While v2 ships
 * as alpha, that URL points at v1.0.5 from 2020, so nothing would ever be offered.
 *
 * Usage:
 *   node scripts/publish-updater.js [--tag v2.0.0-alpha.2] [--manifest dist/updater/latest.json]
 *                                   [--repo eosrio/simpleos] [--branch updater]
 *                                   [--bundle-root <dir>] [--dry-run]
 *
 * Requires the GitHub CLI (`gh`) authenticated with write access to the repo.
 */

const fs = require('node:fs');
const { verifyUpdaterSignature } = require('./verify-updater-signature');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { findSignatures, parseArgs, ROOT } = require('./updater-manifest.js');

function gh(args, { input } = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });
}

function ghOrNull(args) {
  try {
    return gh(args);
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const bundleRoot = args['bundle-root'] ? path.resolve(args['bundle-root']) : ROOT;
  const repo = typeof args.repo === 'string' ? args.repo : 'eosrio/simpleos';
  const branch = typeof args.branch === 'string' ? args.branch : 'updater';
  const manifestPath = path.resolve(
    typeof args.manifest === 'string'
      ? args.manifest
      : path.join(ROOT, 'dist', 'updater', 'latest.json'),
  );

  if (!fs.existsSync(manifestPath)) {
    console.error(`No manifest at ${manifestPath}. Run: bun run updater:manifest`);
    process.exit(1);
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const tag = typeof args.tag === 'string' ? args.tag : `v${manifest.version}`;

  // Upload exactly what the manifest points at — nothing more, nothing stale.
  const referenced = new Map(
    Object.values(manifest.platforms ?? {}).map((entry) => [
      path.basename(new URL(entry.url).pathname),
      entry,
    ]),
  );
  const uploads = [];
  for (const sigPath of findSignatures(bundleRoot)) {
    const artifactPath = sigPath.slice(0, -'.sig'.length);
    if (referenced.has(path.basename(artifactPath)) && fs.existsSync(artifactPath)) {
      const entry = referenced.get(path.basename(artifactPath));
      const signature = fs.readFileSync(sigPath, 'utf8').trim();
      if (signature !== entry.signature.trim()) throw new Error(`Manifest signature differs from ${sigPath}`);
      const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));
      verifyUpdaterSignature(fs.readFileSync(artifactPath), config.plugins?.updater?.pubkey ?? '', signature);
      uploads.push(artifactPath, sigPath);
    }
  }

  // Entries built on another machine are legitimate — they just have to already be
  // attached to the release, or the manifest would advertise a download that 404s.
  const notLocal = [...referenced.keys()].filter(
    (name) => !uploads.some((file) => path.basename(file) === name),
  );
  let releaseAssets = [];
  if (notLocal.length > 0) {
    const assetsJson = ghOrNull(['release', 'view', tag, '--repo', repo, '--json', 'assets']);
    releaseAssets = assetsJson ? JSON.parse(assetsJson).assets.map((asset) => asset.name) : [];
    const orphaned = notLocal.filter((name) => !releaseAssets.includes(name));
    if (orphaned.length > 0) {
      console.error(
        `The manifest references artifacts that are neither built here nor attached to ${tag}:`,
      );
      for (const name of orphaned) console.error(`  ${name}`);
      console.error(
        '\nBuild and publish from the machine that signs that platform, or delete the\n' +
          'stale entries from the manifest before publishing.',
      );
      process.exit(1);
    }
    console.log(`Already on the release (built elsewhere): ${notLocal.join(', ')}`);
  }

  // Merge into whatever is already published so a second machine adds its platform
  // instead of replacing the first one's. Only same-version entries survive.
  const publishedRaw = ghOrNull([
    'api',
    `repos/${repo}/contents/latest.json?ref=${branch}`,
    '--jq',
    '.content',
  ]);
  let publishedPlatforms = {};
  if (publishedRaw && publishedRaw.trim()) {
    try {
      const published = JSON.parse(Buffer.from(publishedRaw.trim(), 'base64').toString('utf8'));
      if (published.version === manifest.version) {
        publishedPlatforms = published.platforms ?? {};
      } else {
        console.log(
          `Published manifest is ${published.version}; replacing it with ${manifest.version}.`,
        );
      }
    } catch {
      console.log('Published manifest could not be parsed; replacing it.');
    }
  }

  const merged = {
    ...manifest,
    platforms: { ...publishedPlatforms, ...(manifest.platforms ?? {}) },
  };
  const mergedRaw = `${JSON.stringify(merged, null, 2)}\n`;

  console.log(`Repo:      ${repo}`);
  console.log(`Tag:       ${tag}`);
  console.log(`Version:   ${manifest.version}`);
  console.log(`Branch:    ${branch}/latest.json`);
  console.log(`Platforms: ${Object.keys(merged.platforms).sort().join(', ')}`);
  console.log(`Uploads:   ${uploads.length} file(s)`);
  for (const file of uploads) console.log(`  ${path.relative(bundleRoot, file)}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing was uploaded or published.');
    return;
  }

  // 1. The release has to exist before assets can be attached to it.
  if (!ghOrNull(['release', 'view', tag, '--repo', repo])) {
    console.log(`\nRelease ${tag} does not exist — creating it as a prerelease.`);
    gh([
      'release',
      'create',
      tag,
      '--repo',
      repo,
      '--title',
      `SimplEOS ${manifest.version}`,
      '--notes',
      manifest.notes || `SimplEOS ${manifest.version}`,
      '--prerelease',
    ]);
  }

  console.log('\nUploading updater artifacts...');
  gh(['release', 'upload', tag, ...uploads, '--repo', repo, '--clobber']);

  // 2. Make sure the manifest branch exists before writing a file to it.
  if (!ghOrNull(['api', `repos/${repo}/branches/${branch}`])) {
    const defaultBranch = gh(['api', `repos/${repo}`, '--jq', '.default_branch']).trim();
    const headSha = gh([
      'api',
      `repos/${repo}/git/refs/heads/${defaultBranch}`,
      '--jq',
      '.object.sha',
    ]).trim();
    console.log(`Creating branch '${branch}' from ${defaultBranch}...`);
    gh([
      'api',
      '-X',
      'POST',
      `repos/${repo}/git/refs`,
      '-f',
      `ref=refs/heads/${branch}`,
      '-f',
      `sha=${headSha}`,
    ]);
  }

  // 3. Publish the manifest. An existing file needs its blob sha to be replaced.
  const existingSha = ghOrNull([
    'api',
    `repos/${repo}/contents/latest.json?ref=${branch}`,
    '--jq',
    '.sha',
  ]);

  const body = {
    message: `chore(updater): publish ${manifest.version}`,
    content: Buffer.from(mergedRaw, 'utf8').toString('base64'),
    branch,
  };
  if (existingSha && existingSha.trim()) body.sha = existingSha.trim();

  console.log('Publishing latest.json...');
  gh(['api', '-X', 'PUT', `repos/${repo}/contents/latest.json`, '--input', '-'], {
    input: JSON.stringify(body),
  });

  console.log(
    `\nPublished. Clients will see ${manifest.version} at\n` +
      `https://raw.githubusercontent.com/${repo}/${branch}/latest.json\n` +
      '(raw.githubusercontent caches for a few minutes.)',
  );
}

main();
