const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { PROJECT, HOST, PORT, HUB } = require('./local-only.cjs');
(async () => {
  if (process.argv.length !== 2) throw new Error('No overrides accepted');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase.json'), 'utf8'));
  if (config.emulators.firestore.host !== HOST || config.emulators.firestore.port !== PORT ||
      config.emulators.hub.host !== HOST || config.emulators.hub.port !== HUB ||
      config.emulators.logging.host !== HOST || config.emulators.logging.port !== 15401 ||
      config.emulators.firestore.websocketPort !== 19160 || Object.keys(config).some(key => !['firestore', 'emulators'].includes(key))) throw new Error('Unexpected configuration');
  for (const port of [PORT, HUB, 15401, 19160]) await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', () => reject(new Error(`Port ${port} occupied; refusing reuse`)));
    server.listen(port, HOST, () => server.close(resolve));
  });
  const env = { ...process.env, GCLOUD_PROJECT: PROJECT, GOOGLE_CLOUD_PROJECT: PROJECT,
    CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', GCE_METADATA_HOST: '127.0.0.1:9' };
  for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'CLOUDSDK_AUTH_ACCESS_TOKEN',
    'FIREBASE_CONFIG', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB']) delete env[key];
  const child = spawn(process.execPath, [require.resolve('firebase-tools/lib/bin/firebase.js'), 'emulators:exec',
    '--project', PROJECT, '--only', 'firestore', '--config', path.join(__dirname, 'firebase.json'),
    '--non-interactive', '--log-verbosity', 'QUIET', 'node --test policy.test.cjs'], { cwd: __dirname, env, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
})().catch(error => { console.error(error.message); process.exitCode = 1; });
