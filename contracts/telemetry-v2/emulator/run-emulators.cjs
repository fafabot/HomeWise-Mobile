'use strict';
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { PROJECT, HOST, PORT, HUB } = require('./local-only.cjs');

async function ensureUnused(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Local port ${port} is occupied; refusing to reuse another emulator`)));
    server.listen(port, HOST, () => server.close(resolve));
  });
}

async function main() {
  if (process.argv.length !== 2) throw new Error('No project, host or command overrides permitted');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase.json'), 'utf8'));
  if (config.emulators.firestore.host !== HOST || config.emulators.firestore.port !== PORT ||
      config.emulators.hub.host !== HOST || config.emulators.hub.port !== HUB ||
      Object.keys(config).some((key) => !['firestore', 'emulators'].includes(key))) throw new Error('Unexpected emulator configuration');
  for (const port of [PORT, HUB, 14401, 19150]) await ensureUnused(port);
  const env = { ...process.env, GCLOUD_PROJECT: PROJECT, GOOGLE_CLOUD_PROJECT: PROJECT,
    CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', GCE_METADATA_HOST: '127.0.0.1:9' };
  for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'CLOUDSDK_AUTH_ACCESS_TOKEN',
    'FIREBASE_CONFIG', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB']) delete env[key];
  const cli = require.resolve('firebase-tools/lib/bin/firebase.js');
  const child = spawn(process.execPath, [cli, 'emulators:exec', '--project', PROJECT, '--only', 'firestore',
    '--config', path.join(__dirname, 'firebase.json'), '--non-interactive', '--log-verbosity', 'QUIET',
    'node --test authorization.test.cjs'], { cwd: __dirname, env, stdio: 'inherit', windowsHide: true });
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
