const { spawn } = require('child_process');

const env = { ...process.env };
const keysToRemove = [
  'GTK_PATH',
  'GTK_EXE_PREFIX',
  'GDK_PIXBUF_MODULEDIR',
  'GDK_PIXBUF_MODULE_FILE',
  'GTK_IM_MODULE_FILE',
  'GIO_MODULE_DIR',
  'LOCPATH'
];

for (const key of keysToRemove) {
  delete env[key];
}

const args = process.argv.slice(2);
const tauriArgs = ['dev', ...args];

const child = spawn('tauri', tauriArgs, {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code === null ? 1 : code);
});

child.on('error', (err) => {
  console.error('Failed to start tauri dev:', err);
  process.exit(1);
});
