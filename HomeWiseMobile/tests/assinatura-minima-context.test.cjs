globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const user = { uid: 'synthetic', email: 'synthetic@example.invalid', displayName: 'Pessoa' };
const initial = { uid: user.uid, nome: 'Pessoa', email: user.email, plano: null, status_assinatura: 'inativa', telefone: 'original', preferencias_notificacoes: { permitir_notificacoes: true } };
async function harness() {
  let context, callback, nextProfile, view;
  const auth = { currentUser: user }, calls = [];
  const handlers = { save: async () => true };
  const deps = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'firebase/auth': { reload: async () => {}, signOut: async () => {}, onAuthStateChanged: (_auth, next) => { callback = next; return () => {}; } },
    'firebase/firestore': { doc: (_db, collection, uid) => ({ collection, uid }),
      onSnapshot: (_ref, _options, next) => { nextProfile = next; return () => {}; } },
    '@/services/firebase': { auth, db: {} },
    '@/services/authService': { salvarPerfilFirestore: async (...args) => { calls.push(args); return handlers.save(...args); } } };
  function load(relative) {
    const module = { exports: {} };
    const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    new Function('module', 'exports', 'require', js)(module, module.exports, name => {
      if (Object.hasOwn(deps, name)) return deps[name];
      if (name === '@/constants/planos') return load('constants/planos.ts');
      throw new Error('Blocked unexpected dependency; no SDK/network: ' + name);
    });
    return module.exports;
  }
  const { AuthProvider, useAuth } = load('contexts/AuthContext.tsx');
  function Capture() { context = useAuth(); return null; }
  act(() => { view = Renderer.create(React.createElement(AuthProvider, null, React.createElement(Capture))); });
  await act(async () => callback(user));
  await act(async () => nextProfile({ exists: () => true, data: () => initial, metadata: { fromCache: false, hasPendingWrites: false } }));
  return { get ctx() { return context; }, handlers, calls,
    snapshot: data => act(() => nextProfile({ exists: () => true, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } })),
    switchUser: async () => {
      await act(async () => { auth.currentUser = { uid: 'other' }; callback(auth.currentUser); });
      await act(async () => nextProfile({ exists: () => true, data: () => ({ uid: 'other', nome: 'Other' }), metadata: { fromCache: false, hasPendingWrites: false } }));
    },
    close: () => act(() => view.unmount()) };
}
test('existing service success updates shared plan/cycle, preserving profile fields and exact existing payload', async () => {
  const h = await harness();
  try {
    await act(async () => assert.equal(await h.ctx.atualizarPlanoAssinatura('plus', 'anual', { telefone: 'novo' }), true));
    assert.equal(h.ctx.perfil.plano, 'plus'); assert.equal(h.ctx.perfil.ciclo_assinatura, 'anual');
    assert.equal(h.ctx.perfil.telefone, 'novo'); assert.deepEqual(h.ctx.perfil.preferencias_notificacoes, initial.preferencias_notificacoes);
    assert.deepEqual(Object.keys(h.calls[0][1]).sort(), ['telefone', 'plano', 'plano_nome', 'ciclo_assinatura', 'status_assinatura', 'assinado_em'].sort());
  } finally { h.close(); }
});
test('false service result never optimistically promotes plan', async () => {
  const h = await harness(); h.handlers.save = async () => false;
  try { await act(async () => assert.equal(await h.ctx.atualizarPlanoAssinatura('plus'), false)); assert.equal(h.ctx.perfil.plano, null); }
  finally { h.close(); }
});
test('pending Promise is not success and can later complete without resubmission', async () => {
  const h = await harness(); let resolve, finish;
  h.handlers.save = () => new Promise(yes => { resolve = yes; });
  try {
    act(() => { finish = h.ctx.atualizarPlanoAssinatura('plus'); });
    assert.equal(h.ctx.perfil.plano, null); assert.equal(h.calls.length, 1);
    await act(async () => { resolve(true); assert.equal(await finish, true); });
    assert.equal(h.ctx.perfil.plano, 'plus'); assert.equal(h.calls.length, 1);
  } finally { h.close(); }
});
test('successful cancellation updates only existing cancellation fields', async () => {
  const h = await harness();
  try {
    h.snapshot({ ...initial, plano: 'plus', status_assinatura: 'ativa' });
    await act(async () => assert.equal(await h.ctx.cancelarAssinatura(), true));
    assert.equal(h.ctx.perfil.plano, null); assert.equal(h.ctx.perfil.status_assinatura, 'cancelada');
    assert.deepEqual(Object.keys(h.calls[0][1]).sort(), ['plano', 'plano_nome', 'status_assinatura'].sort());
  } finally { h.close(); }
});
test('late write completion cannot apply plan to another account', async () => {
  const h = await harness(); let resolve, finish; h.handlers.save = () => new Promise(yes => { resolve = yes; });
  try {
    act(() => { finish = h.ctx.atualizarPlanoAssinatura('plus'); }); await h.switchUser();
    await act(async () => { resolve(true); assert.equal(await finish, false); });
    assert.equal(h.ctx.perfil.uid, 'other'); assert.equal(h.ctx.perfil.plano, undefined);
  } finally { h.close(); }
});
test('documented limitation: later profile snapshot remains authoritative, with no new reconciliation', async () => {
  const h = await harness();
  try {
    await act(async () => h.ctx.atualizarPlanoAssinatura('plus'));
    h.snapshot({ ...initial }); assert.equal(h.ctx.perfil.plano, null);
  } finally { h.close(); }
});
