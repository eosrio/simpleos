const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Add Homebrew node@24 paths to PATH on macOS
const env = { ...process.env };

if (process.platform === 'darwin') {
  const pathsToAdd = [
    '/opt/homebrew/opt/node@24/bin',
    '/usr/local/opt/node@24/bin'
  ];
  const existingPath = env.PATH || '';
  const newPaths = pathsToAdd.filter(p => fs.existsSync(p));
  if (newPaths.length > 0) {
    const separator = path.delimiter; // ':' on POSIX, ';' on Windows
    env.PATH = [...newPaths, existingPath].join(separator);
  }
}

// Verify if node is installed and available
let nodeExists = false;
try {
  const result = spawnSync('node', ['-v'], { env, shell: process.platform === 'win32' });
  if (result.status === 0) {
    nodeExists = true;
  }
} catch (e) {}

if (!nodeExists) {
  if (process.platform === 'darwin') {
    console.error("Node.js is required. Install Node 24 with: brew install node@24");
  } else {
    console.error("Node.js is required. Please install Node.js (v24 is recommended).");
  }
  process.exit(1);
}

// Forward all command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  process.exit(0);
}

const command = args[0];
const commandArgs = args.slice(1);

const child = spawn(command, commandArgs, {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code === null ? 1 : code);
});

child.on('error', (err) => {
  console.error(`Failed to start command ${command}:`, err);
  process.exit(1);
});
