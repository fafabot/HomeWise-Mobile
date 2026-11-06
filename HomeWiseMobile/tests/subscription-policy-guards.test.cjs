const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configuration, requireLocal } = require('../policy/subscription/local-only.cjs');
const safe = { GCLOUD_PROJECT: 'demo-homewise', FIRESTORE_EMULATOR_HOST: '127.0.0.1:19080', FIREBASE_EMULATOR_HUB: '127.0.0.1:15400' };
for (const [label, override] of [
  ['missing endpoints', { FIRESTORE_EMULATOR_HOST: undefined }],
  ['remote host', { FIRESTORE_EMULATOR_HOST: 'example.invalid:19080' }],
  ['other project', { GCLOUD_PROJECT: 'real-project' }],
  ['credential path', { GOOGLE_APPLICATION_CREDENTIALS: 'never-read.json' }],
  ['token', { FIREBASE_TOKEN: 'synthetic-not-secret' }],
  ['non-demo config', { FIREBASE_CONFIG: '{"projectId":"other"}' }],
]) test('emulator guard rejects ' + label + ' before SDK', () => {
  assert.throws(() => configuration({ ...safe, ...override }));
});
test('unavailable local emulator fails without fallback or SDK import', async () => {
  const urls = [];
  await assert.rejects(requireLocal(safe, async (url, options) => {
    urls.push(url); assert.equal(options.redirect, 'error'); throw new Error('Synthetic offline');
  }));
  assert.deepEqual(urls, ['http://127.0.0.1:15400/emulators']);
});
test('unexpected hub refuses SDK initialization', async () => {
  await assert.rejects(requireLocal(safe, async () => ({ ok: true, json: async () => ({ firestore: { host: 'example.invalid', port: 19080 } }) })));
});
