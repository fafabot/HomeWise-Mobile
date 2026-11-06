'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { requireEmulator } = require('./local-only.cjs');
const fixture = require('../fixtures/acceptance.json');

let environment;
let sdk;
let rules;
let deviceA;
let residentA;
let anonymous;
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const A = `central_a_${suffix}`;
const B = `central_b_${suffix}`;
const REVOKED = `revoked_${suffix}`;
const deviceUid = `device-a-${suffix}`;
const residentUid = `resident-a-${suffix}`;
const eventPath = (device, boot) => `centrais/${device}/telemetria_v2/${boot}__0`;

function event(device, boot) {
  return { ...structuredClone(fixture.base_event), device_id: device, boot_id: boot,
    measured_at: sdk.Timestamp.fromDate(new Date(fixture.base_event.measured_at)),
    received_at: sdk.serverTimestamp() };
}

before(async () => {
  // Verify local endpoints BEFORE loading any Firebase SDK. Never use app configuration.
  const local = await requireEmulator();
  rules = require('@firebase/rules-unit-testing');
  sdk = require('firebase/firestore');
  environment = await rules.initializeTestEnvironment({ projectId: local.projectId,
    firestore: { host: local.host, port: local.port,
      rules: fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8') } });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Synthetic documents with per-run IDs: no clearing or deleting any data.
    await sdk.setDoc(sdk.doc(db, `centrais/${A}`), { active: true, device_uid: deviceUid });
    await sdk.setDoc(sdk.doc(db, `centrais/${B}`), { active: true, device_uid: `device-b-${suffix}` });
    await sdk.setDoc(sdk.doc(db, `centrais/${REVOKED}`), { active: true, device_uid: deviceUid });
    await sdk.setDoc(sdk.doc(db, `centrais/${A}/membros/${residentUid}`), { active: true });
    await sdk.setDoc(sdk.doc(db, `usuarios/${residentUid}`), { uid: residentUid, nome: 'Synthetic resident A', dispositivo_id: A, plano: 'basico' });
    await sdk.setDoc(sdk.doc(db, eventPath(B, 'seed-b')), event(B, 'seed-b'));
    await sdk.setDoc(sdk.doc(db, `centrais/${B}/resumos/2026-11-06`), { water_l: 2 });
  });
  deviceA = environment.authenticatedContext(deviceUid).firestore();
  residentA = environment.authenticatedContext(residentUid).firestore();
  anonymous = environment.unauthenticatedContext().firestore();
}, { timeout: 30000 });

after(async () => { if (environment) await environment.cleanup(); });

test('1: central A creates and reads its own event; resident A can read it', async () => {
  const target = eventPath(A, 'own');
  await rules.assertSucceeds(sdk.setDoc(sdk.doc(deviceA, target), event(A, 'own')));
  const snapshot = await rules.assertSucceeds(sdk.getDoc(sdk.doc(deviceA, target)));
  assert.equal(snapshot.data().device_id, A);
  assert.ok(snapshot.data().received_at instanceof sdk.Timestamp);
  await rules.assertSucceeds(sdk.getDoc(sdk.doc(residentA, target)));
});

test('1: central A cannot create in B or spoof payload device_id', async () => {
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(B, 'spoof')), event(B, 'spoof')));
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(A, 'spoof')), event(B, 'spoof')));
  await rules.assertFails(sdk.getDoc(sdk.doc(deviceA, eventPath(B, 'seed-b'))));
});

test('2: resident A cannot get or list B telemetry or read B summaries', async () => {
  await rules.assertFails(sdk.getDoc(sdk.doc(residentA, eventPath(B, 'seed-b'))));
  await rules.assertFails(sdk.getDocs(sdk.query(sdk.collection(residentA, `centrais/${B}/telemetria_v2`), sdk.limit(10))));
  await rules.assertFails(sdk.getDoc(sdk.doc(residentA, `centrais/${B}/resumos/2026-11-06`)));
  await rules.assertSucceeds(sdk.getDocs(sdk.query(sdk.collection(residentA, `centrais/${A}/telemetria_v2`), sdk.limit(10))));
});

test('3: anonymous cannot read, query, create events or read profiles', async () => {
  await rules.assertFails(sdk.getDoc(sdk.doc(anonymous, eventPath(B, 'seed-b'))));
  await rules.assertFails(sdk.getDocs(sdk.query(sdk.collection(anonymous, `centrais/${A}/telemetria_v2`), sdk.limit(10))));
  await rules.assertFails(sdk.setDoc(sdk.doc(anonymous, eventPath(A, 'anonymous')), event(A, 'anonymous')));
  await rules.assertFails(sdk.getDoc(sdk.doc(anonymous, `usuarios/${residentUid}`)));
});

test('4: editing profile selection grants neither membership nor access to B', async () => {
  const profile = sdk.doc(residentA, `usuarios/${residentUid}`);
  await rules.assertSucceeds(sdk.updateDoc(profile, { nome: 'Synthetic updated', dispositivo_id: B }));
  await rules.assertFails(sdk.getDoc(sdk.doc(residentA, eventPath(B, 'seed-b'))));
  await rules.assertFails(sdk.setDoc(sdk.doc(residentA, `centrais/${B}/membros/${residentUid}`), { active: true }));
  await rules.assertFails(sdk.setDoc(sdk.doc(residentA, `centrais/${B}`), { active: true, device_uid: residentUid }));
});

test('4: profile cannot promote plan, change uid or add admin role', async () => {
  const profile = sdk.doc(residentA, `usuarios/${residentUid}`);
  await rules.assertFails(sdk.updateDoc(profile, { plano: 'premium' }));
  await rules.assertFails(sdk.setDoc(profile, { plano: 'premium', status_assinatura: 'ativa' }, { merge: true }));
  await rules.assertFails(sdk.updateDoc(profile, { role: 'admin' }));
  await rules.assertFails(sdk.updateDoc(profile, { uid: 'another-user' }));
  assert.equal((await sdk.getDoc(profile)).data().plano, 'basico');
});

test('4: profile creation accepts only personal fields; ID knowledge is insufficient', async () => {
  const freshUid = `fresh-${suffix}`;
  const fresh = environment.authenticatedContext(freshUid).firestore();
  const target = sdk.doc(fresh, `usuarios/${freshUid}`);
  await rules.assertFails(sdk.setDoc(target, { uid: freshUid, nome: 'Synthetic', dispositivo_id: B, plano: 'premium' }));
  await rules.assertSucceeds(sdk.setDoc(target, { uid: freshUid, nome: 'Synthetic', dispositivo_id: B }));
  await rules.assertFails(sdk.getDoc(sdk.doc(fresh, eventPath(B, 'seed-b'))));
});

test('5: revoked central cannot create even with the same authenticated UID', async () => {
  await rules.assertSucceeds(sdk.setDoc(sdk.doc(deviceA, eventPath(REVOKED, 'before-revoke')), event(REVOKED, 'before-revoke')));
  await environment.withSecurityRulesDisabled(async (context) => {
    await sdk.updateDoc(sdk.doc(context.firestore(), `centrais/${REVOKED}`), { active: false });
  });
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(REVOKED, 'revoked')), event(REVOKED, 'revoked')));
});

test('6: accepted event is immutable, including exact replay via setDoc', async () => {
  const target = sdk.doc(deviceA, eventPath(A, 'immutable'));
  await rules.assertSucceeds(sdk.setDoc(target, event(A, 'immutable')));
  await rules.assertFails(sdk.updateDoc(target, { power_w: 999 }));
  await rules.assertFails(sdk.setDoc(target, event(A, 'immutable')));
  assert.equal((await sdk.getDoc(target)).data().power_w, fixture.base_event.power_w);
});

test('registry, membership and summary writes are denied to producers and residents', async () => {
  await rules.assertFails(sdk.updateDoc(sdk.doc(deviceA, `centrais/${REVOKED}`), { active: true }));
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, `centrais/${A}/membros/${residentUid}`), { active: true }));
  await rules.assertFails(sdk.setDoc(sdk.doc(residentA, `centrais/${A}/resumos/2026-11-06`), { water_l: 999 }));
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, `centrais/${A}/resumos/2026-11-06`), { water_l: 999 }));
});

test('server timestamp, canonical ID, field types and null quality are enforced locally', async () => {
  const badTime = event(A, 'bad-time');
  badTime.received_at = sdk.Timestamp.fromMillis(0);
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(A, 'bad-time')), badTime));
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(A, 'bad-id')), event(A, 'different-boot')));
  const badQuality = event(A, 'bad-quality');
  badQuality.quality.power_w = 'invalid';
  await rules.assertFails(sdk.setDoc(sdk.doc(deviceA, eventPath(A, 'bad-quality')), badQuality));
  const validNull = event(A, 'valid-null');
  validNull.quality.power_w = 'invalid'; validNull.power_w = null;
  await rules.assertSucceeds(sdk.setDoc(sdk.doc(deviceA, eventPath(A, 'valid-null')), validNull));
});
