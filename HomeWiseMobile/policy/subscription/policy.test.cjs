const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { requireLocal } = require('./local-only.cjs');
let env, sdk, testing, owner, writer, anonymous, other;
const uid = 'synthetic-' + randomUUID();
const old = { uid, nome: 'Pessoa sintética', email: 'synthetic@example.invalid', dispositivo_id: '', plano: 'basico', plano_nome: 'Básico', ciclo_assinatura: 'mensal', status_assinatura: 'ativa', telefone: 'original' };
const subscription = (id, patch = {}) => ({ plano: 'plus', plano_nome: 'Plus', ciclo_assinatura: 'anual', status_assinatura: 'ativa',
  assinatura_operacao_id: id, assinatura_atualizada_em: sdk.serverTimestamp(), ...patch });
const ref = db => sdk.doc(db, 'usuarios', uid);
before(async () => {
  const config = await requireLocal(); // Must succeed before ANY SDK is imported.
  testing = require('@firebase/rules-unit-testing'); sdk = require('firebase/firestore');
  env = await testing.initializeTestEnvironment({ projectId: config.projectId, firestore: { host: config.host, port: config.port,
    rules: fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8') } });
  owner = env.authenticatedContext(uid).firestore();
  writer = env.authenticatedContext('synthetic-trusted-writer', { homewise_subscription_writer: true }).firestore();
  other = env.authenticatedContext('synthetic-other').firestore(); anonymous = env.unauthenticatedContext().firestore();
  await env.withSecurityRulesDisabled(context => sdk.setDoc(ref(context.firestore()), old));
});
after(async () => { if (env) await env.cleanup(); });

test('legacy document readable without new fields; unrelated users and anonymous denied', async () => {
  const snapshot = await testing.assertSucceeds(sdk.getDoc(ref(owner)));
  assert.equal(snapshot.data().assinatura_operacao_id, undefined);
  await testing.assertFails(sdk.getDoc(ref(other))); await testing.assertFails(sdk.getDoc(ref(anonymous)));
});
test('ordinary profile merge preserves legacy plan and does not require migration metadata', async () => {
  await testing.assertSucceeds(sdk.setDoc(ref(owner), { nome: 'Nome editado', telefone: 'novo' }, { merge: true }));
  const data = (await sdk.getDoc(ref(owner))).data();
  assert.equal(data.plano, 'basico'); assert.equal(data.assinatura_atualizada_em, undefined);
});
test('profile cannot grant plan, write metadata or promote itself', async () => {
  await testing.assertFails(sdk.setDoc(ref(owner), subscription('user-promotion'), { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(owner), { assinatura_operacao_id: 'metadata-only' }, { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(owner), { homewise_subscription_writer: true }, { merge: true }));
});
test('ordinary identity fields are immutable and other users/anonymous cannot edit profile', async () => {
  await testing.assertFails(sdk.setDoc(ref(owner), { uid: 'other' }, { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(owner), { email: 'other@example.invalid' }, { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(other), { nome: 'Other edit' }, { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(anonymous), { nome: 'Anonymous edit' }, { merge: true }));
});
test('create own normal profile succeeds; create active subscription as end user fails', async () => {
  const fresh = 'synthetic-create-' + randomUUID(); const db = env.authenticatedContext(fresh).firestore();
  await testing.assertSucceeds(sdk.setDoc(sdk.doc(db, 'usuarios', fresh), { uid: fresh, nome: 'Nova pessoa', email: 'new@example.invalid' }));
  const denied = 'synthetic-denied-' + randomUUID(); const rejectedDb = env.authenticatedContext(denied).firestore();
  await testing.assertFails(sdk.setDoc(sdk.doc(rejectedDb, 'usuarios', denied), { uid: denied, nome: 'Pessoa', email: 'new@example.invalid', ...subscription('create-promotion') }));
});
test('trusted writer adds first valid receipt to legacy document', async () => {
  await testing.assertSucceeds(sdk.setDoc(ref(writer), subscription('trusted-first'), { merge: true }));
  assert.equal((await sdk.getDoc(ref(owner))).data().assinatura_operacao_id, 'trusted-first');
});
test('regression: trusted legacy merge cannot change plan while retaining same ID and timestamp', async () => {
  await testing.assertFails(sdk.setDoc(ref(writer), { plano: 'premium', plano_nome: 'Premium' }, { merge: true }));
});
test('reused ID with new server timestamp is also rejected', async () => {
  await testing.assertFails(sdk.setDoc(ref(writer), subscription('trusted-first', { plano: 'premium', plano_nome: 'Premium' }), { merge: true }));
});
test('new ID cannot reuse old timestamp or fabricate client timestamp', async () => {
  const current = (await sdk.getDoc(ref(writer))).data();
  await testing.assertFails(sdk.setDoc(ref(writer), subscription('new-id-old-time', { assinatura_atualizada_em: current.assinatura_atualizada_em }), { merge: true }));
  await testing.assertFails(sdk.setDoc(ref(writer), subscription('new-id-client-time', { assinatura_atualizada_em: sdk.Timestamp.fromMillis(1) }), { merge: true }));
});
test('invalid plan/cycle/status and malformed ID are rejected for trusted writer', async () => {
  for (const patch of [{ plano: 'enterprise' }, { plano_nome: 'Wrong' }, { ciclo_assinatura: 'forever' }, { status_assinatura: 'paid' },
    { assinatura_operacao_id: 42 }, { assinatura_operacao_id: '' }]) {
    await testing.assertFails(sdk.setDoc(ref(writer), subscription(randomUUID(), patch), { merge: true }));
  }
});
test('common profile edit with existing receipt leaves plan and metadata unchanged', async () => {
  const before = (await sdk.getDoc(ref(owner))).data();
  await testing.assertSucceeds(sdk.setDoc(ref(owner), { nome: 'Nome preservado', telefone: 'apenas perfil' }, { merge: true }));
  const after = (await sdk.getDoc(ref(owner))).data();
  assert.equal(after.plano, before.plano); assert.equal(after.assinatura_operacao_id, before.assinatura_operacao_id);
  assert.equal(after.assinatura_atualizada_em.toMillis(), before.assinatura_atualizada_em.toMillis());
});
test('whole-document replacement cannot drop subscription metadata through ordinary profile edit', async () => {
  await testing.assertFails(sdk.setDoc(ref(owner), { uid, nome: 'Replacement', email: old.email }));
});
test('trusted receipt update cannot mutate profile identity; deletion is denied', async () => {
  await testing.assertFails(sdk.setDoc(ref(writer), subscription(randomUUID(), { nome: 'Unrelated edit' }), { merge: true }));
  await testing.assertFails(sdk.deleteDoc(ref(writer))); await testing.assertFails(sdk.deleteDoc(ref(owner)));
});
test('new trusted operation can cancel with fresh server timestamp, preserving ordinary profile', async () => {
  await testing.assertSucceeds(sdk.setDoc(ref(writer), subscription('trusted-cancel', { plano: null, plano_nome: null, status_assinatura: 'cancelada' }), { merge: true }));
  const data = (await sdk.getDoc(ref(owner))).data(); assert.equal(data.status_assinatura, 'cancelada'); assert.equal(data.telefone, 'apenas perfil');
});
