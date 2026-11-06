globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const userA = () => ({ uid: 'A', email: 'a@example.invalid', displayName: 'Pessoa A' });
const userB = () => ({ uid: 'B', email: 'b@example.invalid', displayName: 'Pessoa B' });
const profile = user => ({ uid: user.uid, email: user.email, nome: user.displayName });
const result = (user, estado = 'completo') => ({ usuario: user, estado, sucesso: estado === 'completo',
  etapas: { conta: 'existente', auth: estado === 'completo' ? 'confirmado' : 'nao-confirmado',
    firestore: 'confirmado' }, recuperavel: true, codigo: 'synthetic', causa: new Error('PRIVATE') });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Actual provider, guards and form. Every SDK boundary is replaced before loading;
// unknown imports are denied. No Firebase configuration or network is loaded.
function harness({ renderProfile = false, allowSubscriptionWrites = true } = {}) {
  const sdk = { currentUser: null };
  const listeners = [];
  let authCallback, context, view;
  const calls = { signup: 0, recover: 0, signout: 0, reload: 0, routes: [] };
  const handlers = { readServer: async () => { throw new Error('Synthetic read unavailable'); }, save: async () => true, reload: async () => {}, signout: async () => {},
    signup: async () => { throw new Error('Configure synthetic signup'); },
    recover: async () => result(sdk.currentUser) };
  const native = Object.fromEntries(['View', 'Text', 'TextInput', 'TouchableOpacity', 'ActivityIndicator',
    'ScrollView', 'StatusBar', 'ImageBackground', 'KeyboardAvoidingView', 'Modal'].map(n => [n, n]));
  Object.assign(native, { StyleSheet: { create: s => s }, Platform: { OS: 'web' }, Animated: { View: 'AnimatedView' } });
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/services/firebase': { auth: sdk, db: {} },
    'firebase/auth': { onAuthStateChanged: (_auth, cb) => { authCallback = cb; return () => {}; },
      reload: async user => { calls.reload++; return handlers.reload(user); },
      signOut: async () => { calls.signout++; await handlers.signout(); sdk.currentUser = null; authCallback(null); } },
    'firebase/firestore': { getDocFromServer: (...args) => handlers.readServer(...args), serverTimestamp: () => 'synthetic-server-timestamp', doc: (_db, collection, uid) => ({ collection, uid }),
      onSnapshot: (ref, options, next, error) => {
        assert.equal(options.includeMetadataChanges, true);
        const listener = { ...ref, next, error, closed: false }; listeners.push(listener);
        return () => { listener.closed = true; };
      } },
    '@/services/authService': { cadastrarUsuario: async (...args) => { calls.signup++; return handlers.signup(...args); },
      recuperarPerfilIncompleto: async (...args) => { calls.recover++; return handlers.recover(...args); },
      salvarPerfilFirestore: async (...args) => handlers.save(...args) },
    '@/components/HomeWiseLogo': { __esModule: true, default: 'HomeWiseLogo' },
    '@/components/ProfilePhoto': { __esModule: true, default: 'ProfilePhoto' },
    '@/components/hw/CabecalhoTela': { __esModule: true, default: 'CabecalhoTela' },
    'expo-web-browser': { openBrowserAsync: async () => { throw new Error('Unexpected browser'); } },
    '@/components/HomeWiseTabBar': { __esModule: true, default: 'HomeWiseTabBar' },
    '@/hooks/use-panel-motion': { usePanelMotion: () => ({ style: {}, buttonStyle: {}, press: async () => {}, close: cb => cb() }) },
  };
  const cache = {};
  function load(relative) {
    if (cache[relative]) return cache[relative];
    const js = ts.transpileModule(readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    new Function('module', 'exports', 'require', 'process', js)(module, module.exports, name => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name === '../../assets/images/welcome-home.png') return 1;
      if (name.startsWith('@/')) {
        const rel = name.slice(2);
        return load(rel + (existsSync(path.join(__dirname, '../src', rel + '.ts')) ? '.ts' : '.tsx'));
      }
      throw new Error('Blocked dependency: ' + name);
    }, { ...process, env: { ...process.env, EXPO_PUBLIC_HOMEWISE_REVIEW: allowSubscriptionWrites ? '1' : '0' } });
    return cache[relative] = module.exports;
  }
  const Stack = ({ children }) => children;
  Stack.Protected = ({ guard, children }) => guard ? children : null;
  Stack.Screen = ({ name }) => React.createElement('Route', { name }, name === 'cadastro'
    ? React.createElement(load('app/cadastro.tsx').default) : name === 'perfil' && renderProfile
      ? React.createElement(load('app/perfil.tsx').default) : null);
  dependencies['expo-router'] = { Stack, Link: 'Link', useRouter: () => ({ push: route => calls.routes.push(route) }) };
  const authModule = load('contexts/AuthContext.tsx');
  function Capture() { context = authModule.useAuth(); return null; }
  const Root = load('app/_layout.tsx').default;
  // Root uses the same real Provider; Capture is injected as a sibling of Navigation.
  const Provider = authModule.AuthProvider;
  authModule.AuthProvider = ({ children }) => React.createElement(Provider, null,
    React.createElement(Capture), children);
  act(() => { view = Renderer.create(React.createElement(Root)); });
  const emit = async account => act(async () => { sdk.currentUser = account; authCallback(account); });
  const snapshot = async (data, { index = listeners.length - 1, fromCache = false, hasPendingWrites = false } = {}) =>
    act(async () => listeners[index].next({ exists: () => data !== null, data: () => data,
      metadata: { fromCache, hasPendingWrites } }));
  const routes = () => view.root.findAllByType('Route').map(n => n.props.name);
  const text = () => view.root.findAllByType('Text').map(n => n.props.children).flat().join(' ');
  const button = label => view.root.findAllByType('TouchableOpacity').find(n =>
    n.findAllByType('Text').some(t => t.props.children === label));
  const press = async label => act(async () => { const target = button(label); assert.ok(target, label); if (!target.props.disabled) target.props.onPress(); });
  const fill = () => act(() => {
    for (const input of view.root.findAllByType('TextInput')) {
      if (input.props.placeholder === 'Seu nome') input.props.onChangeText('Pessoa A');
      if (input.props.accessibilityLabel === 'E-mail') input.props.onChangeText('a@example.invalid');
      if (['Senha', 'Confirmar senha'].includes(input.props.accessibilityLabel)) input.props.onChangeText('synthetic-password');
    }
  });
  return { get ctx() { return context; }, sdk, handlers, calls, listeners, emit, snapshot, routes, text, press, fill,
    notify: async account => act(async () => authCallback(account)),
    async start() { await emit(null); act(() => context.selectEntry('cadastro')); },
    close() { act(() => view.unmount()); },
    get view() { return view; } };
}

test('integrated signup survives Auth callback and early snapshot, complete opens app only after receipt', async () => {
  const h = harness(); const done = deferred(); const a = userA();
  try {
    await h.start(); h.fill();
    h.handlers.signup = () => done.promise;
    await h.press('Criar minha conta');
    const formKey = h.ctx.chaveFormulario;
    await h.emit(a); await h.snapshot(profile(a));
    assert.equal(h.ctx.chaveFormulario, formKey);
    assert.ok(h.routes().includes('cadastro')); assert.ok(!h.routes().includes('index'));
    assert.equal(h.view.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'Senha').props.value, 'synthetic-password');
    await act(async () => done.resolve(result(a)));
    assert.ok(h.routes().includes('index')); assert.equal(h.ctx.estadoPerfil, 'completo');
    assert.equal(h.calls.signup, 1); assert.equal(h.calls.reload, 0);
  } finally { h.close(); }
});

test('partial signup retains recovery, snapshot and read retry cannot bypass composed failure', async () => {
  const h = harness(); const done = deferred(); const a = userA();
  try {
    await h.start(); h.fill(); h.handlers.signup = () => done.promise;
    await h.press('Criar minha conta'); await h.emit(a); await h.snapshot(profile(a));
    await act(async () => done.resolve(result(a, 'parcial')));
    assert.match(h.text(), /Sua conta foi criada/);
    assert.equal(h.ctx.perfilConcluido, false);
    await h.press('Tentar consultar perfil'); await h.snapshot(profile(a));
    assert.equal(h.ctx.perfilConcluido, false);
    const recover = deferred(); h.handlers.recover = () => recover.promise;
    await h.press('Concluir meu perfil'); await h.snapshot(profile(a));
    assert.equal(h.ctx.perfilConcluido, false);
    await act(async () => recover.resolve(result(a)));
    assert.equal(h.ctx.perfilConcluido, true);
    assert.equal(h.calls.signup, 1); assert.equal(h.calls.recover, 1);
  } finally { h.close(); }
});

test('signup failure releases locks and preserves form for retry', async () => {
  const h = harness();
  try {
    await h.start(); h.fill();
    h.handlers.signup = async () => ({ ...result(null, 'falha'), etapas: {} });
    await h.press('Criar minha conta'); await h.press('Criar minha conta');
    assert.equal(h.ctx.operacaoPerfil, false); assert.equal(h.calls.signup, 2);
    assert.ok(h.routes().includes('cadastro')); assert.doesNotMatch(h.text(), /PRIVATE/);
  } finally { h.close(); }
});

for (const central of [undefined, '']) test('restored complete profile does not require optional central ' + String(central), async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); assert.ok(!h.routes().includes('index'));
    await h.snapshot({ ...profile(a), dispositivo_id: central });
    assert.equal(h.ctx.perfilConcluido, true); assert.ok(h.routes().includes('index'));
    assert.equal(h.calls.signup, 0); assert.equal(h.calls.reload, 1);
  } finally { h.close(); }
});

test('restored missing profile offers same-account recovery without password or account creation', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(null);
    assert.equal(h.ctx.estadoPerfil, 'ausente'); assert.equal(h.ctx.perfil, null);
    await h.press('Concluir meu perfil');
    assert.equal(h.calls.signup, 0); assert.equal(h.calls.recover, 1);
    assert.equal(h.ctx.perfilConcluido, false);
    await h.snapshot(profile(a)); assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('read error remains error, never absence, retries through a new listener', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a);
    await act(async () => h.listeners.at(-1).error(new Error('PRIVATE')));
    assert.equal(h.ctx.estadoPerfil, 'erro'); assert.equal(h.ctx.perfil, null);
    assert.doesNotMatch(h.text(), /PRIVATE/);
    await h.press('Tentar consultar perfil'); await h.snapshot(profile(a));
    assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('Auth restoration failure cannot be masked by a valid Firestore snapshot', async () => {
  const h = harness(); const a = userA();
  try {
    h.handlers.reload = async () => { throw new Error('PRIVATE'); };
    await h.emit(a); await h.snapshot(profile(a));
    assert.equal(h.ctx.estadoPerfil, 'erro'); assert.equal(h.ctx.perfilConcluido, false);
    h.handlers.reload = async () => {};
    await h.press('Tentar consultar perfil'); await h.snapshot(profile(a));
    assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('cache and pending writes do not confirm existence or absence', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(profile(a), { fromCache: true });
    assert.equal(h.ctx.estadoPerfil, 'verificando');
    await h.snapshot(null, { fromCache: true }); assert.notEqual(h.ctx.estadoPerfil, 'ausente');
    await h.snapshot(profile(a), { hasPendingWrites: true }); assert.equal(h.ctx.perfilConcluido, false);
    await h.snapshot(profile(a)); assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

for (const patch of [{ uid: 'B' }, { email: 'other@example.invalid' }, { nome: '' }, { nome: 'Other' }, { nome: null }])
  test('invalid required persisted identity remains incomplete ' + JSON.stringify(patch), async () => {
    const h = harness(); const a = userA();
    try { await h.emit(a); await h.snapshot({ ...profile(a), ...patch }); assert.equal(h.ctx.perfilConcluido, false); }
    finally { h.close(); }
  });

test('account switch clears drafts and rejects old snapshots, Auth reloads and operation receipts, including A-B-A', async () => {
  const h = harness(); const a = userA(); const b = userB(); const oldReload = deferred();
  try {
    h.handlers.reload = () => oldReload.promise;
    await h.emit(a); const old = h.listeners.length - 1;
    let token; act(() => { token = h.ctx.iniciarOperacaoPerfil(a.email); });
    const key = h.ctx.chaveFormulario;
    h.handlers.reload = async () => {};
    await h.emit(b); assert.ok(h.ctx.chaveFormulario > key); assert.equal(h.ctx.perfil, null);
    await h.snapshot(profile(a), { index: old });
    act(() => h.ctx.finalizarOperacaoPerfil(token, result(a)));
    await act(async () => oldReload.resolve());
    assert.equal(h.ctx.perfil, null); assert.equal(h.ctx.operacaoPerfil, false);
    const email = h.view.root.findAllByType('TextInput').find(n => n.props.accessibilityLabel === 'E-mail');
    assert.equal(email.props.value, b.email);
    await h.emit(a); await h.snapshot(profile(a), { index: old });
    assert.equal(h.ctx.perfilConcluido, false);
    await h.snapshot(profile(a)); assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('logout is available during incomplete operation and late account callback cannot restore it', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(null);
    let token; act(() => { token = h.ctx.iniciarOperacaoPerfil(a.email); });
    await h.press('Sair da conta');
    assert.equal(h.ctx.user, null); assert.equal(h.ctx.perfil, null);
    act(() => h.ctx.finalizarOperacaoPerfil(token, result(a)));
    await h.emit(a); assert.equal(h.ctx.user, null);
    assert.ok(h.routes().includes('boas-vindas'));
  } finally { h.close(); }
});

test('logout failure is recoverable and does not claim successful logout', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(null);
    h.handlers.signout = async () => { throw new Error('PRIVATE'); };
    await h.press('Sair da conta'); assert.equal(h.ctx.user.uid, a.uid); assert.equal(h.ctx.erroSaida, true);
    assert.equal(h.ctx.perfilConcluido, false); assert.doesNotMatch(h.text(), /PRIVATE/);
    h.handlers.signout = async () => {}; await h.press('Sair da conta'); assert.equal(h.ctx.user, null);
  } finally { h.close(); }
});

test('signup receipt before delayed Auth callback keeps form identity and preserves partial block', async () => {
  const h = harness(); const a = userA();
  try {
    await h.start(); h.fill(); const key = h.ctx.chaveFormulario;
    h.handlers.signup = async () => { h.sdk.currentUser = a; return result(a, 'parcial'); };
    await h.press('Criar minha conta'); await h.emit(a); await h.snapshot(profile(a));
    assert.equal(h.ctx.chaveFormulario, key); assert.equal(h.ctx.perfilConcluido, false);
    assert.match(h.text(), /Sua conta foi criada/);
  } finally { h.close(); }
});

test('established session keeps editor routes through Auth rename and local pending writes', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(profile(a));
    assert.ok(h.routes().includes('editar-perfil'));
    a.displayName = 'Nome editado';
    await h.snapshot(profile(a), { hasPendingWrites: true });
    assert.ok(h.routes().includes('editar-perfil'));
    assert.equal(h.ctx.perfil.nome, 'Pessoa A');
    await h.snapshot(profile(a));
    assert.equal(h.ctx.perfilConcluido, true);
    assert.equal(h.ctx.perfil.nome, 'Nome editado');
  } finally { h.close(); }
});

test('restored Auth name missing requires recovery even with persisted profile', async () => {
  const h = harness(); const a = userA(); const stored = profile(a); a.displayName = null;
  try {
    await h.emit(a); await h.snapshot(stored);
    assert.equal(h.ctx.perfilConcluido, false);
    h.handlers.recover = async () => { a.displayName = stored.nome; return result(a); };
    await h.press('Concluir meu perfil');
    assert.equal(h.ctx.perfilConcluido, true); assert.equal(h.calls.signup, 0);
  } finally { h.close(); }
});

test('unexpected exception after creation leaves recovery available and releases synchronous lock', async () => {
  const h = harness(); const a = userA(); const done = deferred();
  try {
    await h.start(); h.fill(); h.handlers.signup = () => done.promise;
    await h.press('Criar minha conta'); await h.emit(a); await h.snapshot(null);
    await act(async () => done.reject(new Error('PRIVATE')));
    assert.equal(h.ctx.operacaoPerfil, false); assert.equal(h.ctx.perfilConcluido, false);
    await h.press('Concluir meu perfil'); await h.snapshot(profile(a));
    assert.equal(h.calls.signup, 1); assert.equal(h.calls.recover, 1);
    assert.equal(h.ctx.perfilConcluido, true); assert.doesNotMatch(h.text(), /PRIVATE/);
  } finally { h.close(); }
});

test('context blocks duplicate operation and stale Auth reload failure during recovery', async () => {
  const h = harness(); const a = userA(); const pending = deferred();
  try {
    h.handlers.reload = () => pending.promise;
    await h.emit(a); await h.snapshot(profile(a));
    let token;
    act(() => { token = h.ctx.iniciarOperacaoPerfil(a.email); assert.equal(h.ctx.iniciarOperacaoPerfil(a.email), null); });
    await act(async () => pending.reject(new Error('PRIVATE')));
    act(() => h.ctx.finalizarOperacaoPerfil(token, result(a)));
    assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('failure rejecting a late sign-in exposes actual incomplete session and retryable logout', async () => {
  const h = harness(); const a = userA();
  try {
    await h.emit(a); await h.snapshot(null); await h.press('Sair da conta');
    h.handlers.signout = async () => { throw new Error('PRIVATE'); };
    await h.emit(a);
    assert.equal(h.ctx.user.uid, a.uid); assert.equal(h.ctx.erroSaida, true);
    assert.equal(h.ctx.perfilConcluido, false); assert.ok(h.routes().includes('cadastro'));
    h.handlers.signout = async () => {}; await h.press('Sair da conta');
    assert.equal(h.ctx.user, null);
  } finally { h.close(); }
});

for (const entry of ['login', 'cadastro', null]) {
  for (const complete of [true, false]) {
    test(`explicit logout from ${complete ? 'Perfil' : 'completion'} after ${entry || 'restoration'} has only Welcome route`, async () => {
      const h = harness({ renderProfile: complete }); const a = userA();
      try {
        await h.emit(null);
        if (entry) act(() => h.ctx.selectEntry(entry));
        await h.emit(a); await h.snapshot(complete ? profile(a) : null);
        assert.equal(h.ctx.entry, entry);
        const oldListener = h.listeners.length - 1;
        await h.press('Sair da conta');
        if (complete) await h.press('Sair');
        assert.deepEqual(h.routes(), ['boas-vindas']);
        assert.equal(h.ctx.user, null); assert.equal(h.ctx.perfil, null);
        assert.equal(h.ctx.entry, null); assert.equal(h.ctx.dispositivoId, '');
        assert.equal(h.ctx.estadoPerfil, 'sem-sessao'); assert.equal(h.ctx.erroSaida, false);
        assert.equal(h.calls.signout, 1); assert.deepEqual(h.calls.routes, []);
        await h.snapshot(profile(a), { index: oldListener });
        assert.deepEqual(h.routes(), ['boas-vindas']);
      } finally { h.close(); }
    });
  }
}

test('Perfil failed logout keeps modal and active session, duplicate presses share context lock', async () => {
  const h = harness({ renderProfile: true }); const a = userA(); const pending = deferred();
  try {
    await h.emit(null); act(() => h.ctx.selectEntry('login'));
    await h.emit(a); await h.snapshot(profile(a));
    await h.press('Sair da conta');
    h.handlers.signout = () => pending.promise;
    await h.press('Sair');
    act(() => { void h.ctx.sairDaConta(); });
    assert.equal(h.calls.signout, 1); assert.equal(h.ctx.saindo, true);
    act(() => h.view.root.findByType('Modal').props.onRequestClose());
    assert.equal(h.view.root.findByType('Modal').props.visible, true);
    assert.ok(h.routes().includes('perfil')); assert.ok(!h.routes().includes('boas-vindas'));
    await act(async () => pending.reject(new Error('PRIVATE')));
    assert.equal(h.ctx.user.uid, a.uid); assert.equal(h.ctx.erroSaida, true);
    assert.ok(h.routes().includes('perfil')); assert.match(h.text(), /Não foi possível sair/);
    assert.doesNotMatch(h.text(), /PRIVATE/); assert.deepEqual(h.calls.routes, []);
    h.handlers.signout = async () => {}; await h.press('Sair');
    assert.deepEqual(h.routes(), ['boas-vindas']);
  } finally { h.close(); }
});

test('obsolete Auth callbacks cannot clear a newly authenticated session or restore previous account', async () => {
  const h = harness(); const a = userA(); const b = userB();
  try {
    await h.emit(a); await h.snapshot(null); await h.press('Sair da conta');
    act(() => h.ctx.selectEntry('login'));
    await h.emit(b); await h.snapshot(profile(b));
    await h.notify(null); await h.notify(a);
    assert.equal(h.ctx.user.uid, b.uid); assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('late logout rejection cannot set an error in a new session after confirmed signed-out callback', async () => {
  const h = harness(); const a = userA(); const b = userB(); const pending = deferred();
  try {
    await h.emit(a); await h.snapshot(null);
    h.handlers.signout = () => pending.promise;
    await h.press('Sair da conta'); await h.emit(null);
    assert.deepEqual(h.routes(), ['boas-vindas']);
    act(() => h.ctx.selectEntry('login'));
    await h.emit(b); await h.snapshot(profile(b));
    await act(async () => pending.reject(new Error('PRIVATE')));
    assert.equal(h.ctx.user.uid, b.uid); assert.equal(h.ctx.erroSaida, false);
    assert.equal(h.ctx.perfilConcluido, true);
  } finally { h.close(); }
});

test('subscription pending local echo cannot activate; acknowledgement pins across old snapshots and listener retry', async () => {
  const h = harness(); const a = userA(); const pending = deferred(); let patch, finish;
  try {
    await h.emit(a); await h.snapshot(profile(a));
    h.handlers.save = (_uid, data) => { patch = data; return pending.promise; };
    act(() => { finish = h.ctx.atualizarPlanoAssinatura('plus', 'anual'); });
    await h.snapshot({ ...profile(a), ...patch }, { hasPendingWrites: true });
    assert.equal(h.ctx.perfil.plano, undefined); assert.equal(h.ctx.assinaturaPendente, true);
    await h.snapshot({ ...profile(a), ...patch, assinatura_atualizada_em: { toMillis: () => 100 } });
    assert.equal(h.ctx.perfil.plano, undefined);
    await act(async () => { pending.resolve(true); await finish; });
    assert.equal(h.ctx.perfil.plano, 'plus'); assert.equal(h.ctx.assinaturaPendente, false);
    await h.snapshot({ ...profile(a), telefone: 'new phone', plano: null });
    assert.equal(h.ctx.perfil.plano, 'plus'); assert.equal(h.ctx.perfil.telefone, 'new phone');
    act(() => h.ctx.tentarNovamentePerfil()); await h.snapshot(profile(a));
    assert.equal(h.ctx.perfil.plano, 'plus'); assert.ok(h.routes().includes('index'));
    await h.snapshot({ ...profile(a), assinatura_operacao_id: 'newer-remote', assinatura_atualizada_em: { toMillis: () => 200 }, plano: null, status_assinatura: 'cancelada' });
    assert.equal(h.ctx.perfil.plano, null);
    await h.snapshot({ ...profile(a), ...patch, assinatura_atualizada_em: { toMillis: () => 100 } });
    assert.equal(h.ctx.perfil.plano, null, 'older matching original receipt must not undo later server change');
  } finally { h.close(); }
});

test('subscription failure never activates and completion after account switch cannot leak plan', async () => {
  const h = harness(); const a = userA(); const b = userB();
  try {
    await h.emit(a); await h.snapshot(profile(a));
    h.handlers.save = async () => false;
    await act(async () => { assert.equal(await h.ctx.atualizarPlanoAssinatura('plus'), false); });
    assert.equal(h.ctx.perfil.plano, undefined);
    const pending = deferred(); h.handlers.save = () => pending.promise; let finish;
    act(() => { finish = h.ctx.atualizarPlanoAssinatura('plus'); });
    await h.emit(b); await h.snapshot(profile(b));
    await act(async () => { pending.resolve(true); assert.equal(await finish, false); });
    assert.equal(h.ctx.perfil.uid, b.uid); assert.equal(h.ctx.perfil.plano, undefined);
  } finally { h.close(); }
});

const serverSnapshot = data => ({ exists: () => data !== null, data: () => data,
  metadata: { fromCache: false, hasPendingWrites: false } });
async function confirmedSubscription(h, a) {
  await h.emit(a); await h.snapshot(profile(a)); let patch;
  h.handlers.save = async (_uid, value) => { patch = value; return true; };
  await act(async () => { assert.equal(await h.ctx.atualizarPlanoAssinatura('plus', 'anual'), true); });
  const data = { ...profile(a), ...patch, assinatura_atualizada_em: { toMillis: () => 100 } };
  await h.snapshot(data); return data;
}
test('legacy conflict queries server, remains unknown on confirmation of conflict, explicit retry resolves; profile guards stay usable', async () => {
  const h = harness(); const a = userA();
  try {
    const correct = await confirmedSubscription(h, a); const wrong = { ...correct, plano: 'basico' };
    let reads = 0; h.handlers.readServer = async () => { reads++; return serverSnapshot(wrong); };
    await h.snapshot(wrong);
    assert.equal(h.ctx.assinaturaEstado, 'inconsistente'); assert.equal(h.ctx.perfil.plano, undefined);
    assert.equal(h.ctx.perfilConcluido, true); assert.ok(h.routes().includes('editar-perfil'));
    let writes = 0; h.handlers.save = async () => { writes++; return true; };
    await act(async () => { assert.equal(await h.ctx.atualizarPlanoAssinatura('premium'), false); });
    assert.equal(writes, 0); await h.snapshot(wrong); assert.equal(reads, 1, 'bounded automatic query, no loop');
    h.handlers.readServer = async () => serverSnapshot(correct);
    await act(async () => h.ctx.reconciliarAssinatura());
    assert.equal(h.ctx.assinaturaEstado, 'pronta'); assert.equal(h.ctx.perfil.plano, 'plus');
    assert.match(h.ctx.assinaturaMensagem, /Consulta ao servidor reconciliou/);
  } finally { h.close(); }
});
test('server read timeout is unknown, late result ignored, manual retry possible', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); const a = userA();
  try {
    const correct = await confirmedSubscription(h, a); const pending = deferred(); h.handlers.readServer = () => pending.promise;
    await h.snapshot({ ...correct, status_assinatura: 'cancelada' });
    assert.equal(h.ctx.assinaturaEstado, 'consultando');
    await act(async () => { t.mock.timers.tick(8000); });
    assert.equal(h.ctx.assinaturaEstado, 'inconsistente'); assert.equal(h.ctx.perfil.plano, undefined);
    await act(async () => pending.resolve(serverSnapshot(correct)));
    assert.equal(h.ctx.assinaturaEstado, 'inconsistente');
    h.handlers.readServer = async () => serverSnapshot(correct);
    await act(async () => h.ctx.reconciliarAssinatura()); assert.equal(h.ctx.assinaturaEstado, 'pronta');
  } finally { h.close(); }
});
test('reconciliation read errors are not document absence and old user callback cannot affect new account', async () => {
  const h = harness(); const a = userA(); const b = userB();
  try {
    const correct = await confirmedSubscription(h, a);
    h.handlers.readServer = async () => { throw new Error('PRIVATE'); };
    await h.snapshot({ ...correct, ciclo_assinatura: 'mensal' });
    assert.equal(h.ctx.assinaturaEstado, 'inconsistente'); assert.notEqual(h.ctx.estadoPerfil, 'ausente');
    assert.equal(h.ctx.perfilConcluido, true);
    const pending = deferred(); h.handlers.readServer = () => pending.promise;
    let finish; act(() => { finish = h.ctx.reconciliarAssinatura(); });
    await h.emit(b); await h.snapshot(profile(b));
    await act(async () => { pending.resolve(serverSnapshot(correct)); await finish; });
    assert.equal(h.ctx.user.uid, b.uid); assert.equal(h.ctx.assinaturaEstado, 'pronta'); assert.equal(h.ctx.assinaturaMensagem, '');
  } finally { h.close(); }
});
test('unknown deployed policy blocks all normal-build subscription mutations but not legacy reads or profile guards', async () => {
  const h = harness({ allowSubscriptionWrites: false }); const a = userA();
  try {
    await h.emit(a); await h.snapshot({ ...profile(a), plano: 'basico', status_assinatura: 'ativa' });
    let writes = 0; h.handlers.save = async () => { writes++; return true; };
    await act(async () => {
      assert.equal(await h.ctx.atualizarPlanoAssinatura('premium'), false);
      assert.equal(await h.ctx.cancelarAssinatura(), false);
    });
    assert.equal(writes, 0); assert.equal(h.ctx.perfil.plano, 'basico'); assert.equal(h.ctx.perfilConcluido, true);
    assert.ok(h.routes().includes('editar-perfil')); assert.ok(h.routes().includes('perfil'));
  } finally { h.close(); }
});

test('failed SDK acknowledgement cannot discard evidence of conflicting pending snapshot', async () => {
  const h = harness(); const a = userA(); const pending = deferred(); let patch, finish;
  try {
    await h.emit(a); await h.snapshot(profile(a));
    h.handlers.save = (_uid, value) => { patch = value; return pending.promise; };
    act(() => { finish = h.ctx.atualizarPlanoAssinatura('plus', 'anual'); });
    const wrong = { ...profile(a), ...patch, plano: 'basico', assinatura_atualizada_em: { toMillis: () => 100 } };
    h.handlers.readServer = async () => serverSnapshot(wrong);
    await h.snapshot(wrong);
    await act(async () => { pending.resolve(false); assert.equal(await finish, false); });
    assert.equal(h.ctx.assinaturaEstado, 'inconsistente'); assert.equal(h.ctx.perfil.plano, undefined);
  } finally { h.close(); }
});
