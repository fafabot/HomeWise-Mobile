'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assertConfiguration, requireEmulator } = require('./local-only.cjs');
const safe = { GCLOUD_PROJECT: 'demo-homewise', GOOGLE_CLOUD_PROJECT: 'demo-homewise',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080', FIREBASE_EMULATOR_HUB: '127.0.0.1:14400' };

test('accept only fixed demo project and loopback endpoints', () => {
  assert.equal(assertConfiguration(safe).projectId, 'demo-homewise');
});
for (const [key, value] of [
  ['GCLOUD_PROJECT', 'real-project'], ['GOOGLE_CLOUD_PROJECT', 'real-project'],
  ['FIRESTORE_EMULATOR_HOST', undefined], ['FIRESTORE_EMULATOR_HOST', 'firestore.googleapis.com:443'],
  ['FIRESTORE_EMULATOR_HOST', 'localhost:18080'], ['FIREBASE_EMULATOR_HUB', undefined],
  ['FIREBASE_EMULATOR_HUB', '192.168.1.2:14400'],
  ['FIREBASE_CONFIG', '{"projectId":"real-project"}'], ['FIREBASE_CONFIG', '/path/to/config.json'],
  ['GOOGLE_APPLICATION_CREDENTIALS', 'credentials.json'], ['FIREBASE_TOKEN', 'synthetic-denied'],
]) {
  test(`fail closed: ${key}=${String(value)}`, () => {
    assert.throws(() => assertConfiguration({ ...safe, [key]: value }));
  });
}
test('missing emulator configuration exits nonzero before SDK initialization', () => {
  const env = { ...process.env };
  for (const key of Object.keys(safe)) delete env[key];
  delete env.FIREBASE_CONFIG;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'local-only.cjs')], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Local Firestore emulator required/);
});

test('unavailable emulator rejects without trying any fallback endpoint', async () => {
  const urls = [];
  await assert.rejects(requireEmulator(safe, async (url) => {
    urls.push(url); throw new Error('Synthetic local connection refused');
  }), /local connection refused/);
  assert.deepEqual(urls, ['http://127.0.0.1:14400/emulators']);
});

test('unexpected hub endpoint rejected before SDK or Firestore calls', async () => {
  const urls = [];
  await assert.rejects(requireEmulator(safe, async (url) => {
    urls.push(url); return { ok: true, json: async () => ({ firestore: { host: 'remote.example', port: 443 } }) };
  }), /Unexpected emulator/);
  assert.equal(urls.length, 1);
});

test('local probe HTTP failure rejects; redirects are not followed', async () => {
  await assert.rejects(requireEmulator(safe, async (_url, options) => {
    assert.equal(options.redirect, 'error');
    return { ok: false, status: 503 };
  }), /HTTP 503/);
});
