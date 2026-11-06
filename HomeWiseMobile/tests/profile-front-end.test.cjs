globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const syntheticUser = { uid: 'synthetic-user', email: 'synthetic@example.invalid' };
function result(estado, extra = {}) {
  return { sucesso: estado === 'completo', estado, usuario: syntheticUser,
    etapas: { conta: 'criada', auth: 'confirmado', firestore: estado === 'completo' ? 'confirmado' : 'nao-confirmado' },
    recuperavel: estado !== 'completo', erro: 'INTERNAL_TECHNICAL_ERROR', codigo: 'permission-denied',
    causa: new Error('SECRET_DIAGNOSTIC'), ...extra };
}
function harness({ user = null, os = 'web' } = {}) {
  const calls = { signup: [], recover: [], edit: [], login: [], alerts: [], routes: [], entries: [] };
  const auth = { iniciarOperacaoPerfil: () => 1, finalizarOperacaoPerfil() {}, tentarNovamentePerfil() {}, sairDaConta: async () => {}, perfilConcluido: false, user, perfil: { nome: 'Nome Original', telefone: 'original', cidade: 'Cidade Original' },
    selectEntry: entry => calls.entries.push(entry) };
  const handlers = { signup: async () => result('completo'), recover: async () => result('completo'),
    edit: async () => result('completo'), login: async () => ({ sucesso: true }), press: async () => {} };
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'ScrollView', 'StatusBar',
    'Text', 'TextInput', 'TouchableOpacity', 'View', 'ImageBackground'].map(name => [name, name]));
  native.StyleSheet = { create: value => value, absoluteFill: {} };
  native.Platform = { OS: os };
  native.Animated = { View: 'AnimatedView' };
  const invoke = name => async (...args) => { calls[name].push(args); return handlers[name](...args); };
  const dependencies = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { Link: 'Link', useRouter: () => ({ push: route => calls.routes.push(route) }) },
    '@/contexts/AuthContext': { AuthProvider: ({ children }) => children, useAuth: () => auth },
    '@/components/HomeWiseTabBar': { __esModule: true, default: 'HomeWiseTabBar' },
    '@/services/authService': { cadastrarUsuario: invoke('signup'), recuperarPerfilIncompleto: invoke('recover'),
      atualizarPerfilUsuario: invoke('edit'), loginUsuario: invoke('login') },
    '@/components/HomeWiseLogo': { __esModule: true, default: 'HomeWiseLogo' },
    '@/components/ProfilePhoto': { __esModule: true, default: 'ProfilePhoto' },
    '@/components/hw/CabecalhoTela': { __esModule: true, default: 'CabecalhoTela' },
    '@/hooks/use-panel-motion': { usePanelMotion: () => ({ style: {}, buttonStyle: {}, press: () => handlers.press(),
      buttonDown() {}, buttonUp() {}, close: callback => callback() }) },
    '@/utils/alert': { showAlert: (...args) => calls.alerts.push(args) },
  };
  const Stack = ({ children }) => children;
  Stack.Protected = ({ guard, children }) => guard ? children : null;
  Stack.Screen = 'StackScreen';
  dependencies['expo-router'].Stack = Stack;
  const cache = {};
  function load(relative) {
    if (cache[relative]) return cache[relative];
    const filename = path.join(__dirname, '../src', relative);
    const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('module', 'exports', 'require', js)(module, module.exports, name => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name === '../../assets/images/welcome-home.png') return 1;
      if (name.startsWith('@/')) {
        const rel = name.slice(2);
        return load(rel + (existsSync(path.join(__dirname, '../src', rel + '.ts')) ? '.ts' : '.tsx'));
      }
      throw new Error(`Blocked dependency (no SDK/network): ${name}`);
    });
    return (cache[relative] = module.exports);
  }
  function render(relative, props = {}, options) {
    const Screen = load(relative).default;
    let view;
    act(() => { view = Renderer.create(React.createElement(Screen, props), options); });
    return { view, refresh: () => act(() => view.update(React.createElement(Screen, props))),
      unmount: () => act(() => view.unmount()) };
  }
  return { auth, calls, handlers, render };
}
const text = node => [].concat(node.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join('');
const texts = view => view.root.findAllByType('Text').map(text).join('\n');
const button = (view, label) => view.root.findAllByType('TouchableOpacity')
  .find(node => node.findAllByType('Text').some(n => text(n) === label));
const input = (view, label) => view.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label);
async function press(view, label) { await act(async () => { button(view, label).props.onPress(); }); }
function fillSignup(view) {
  act(() => {
    view.root.findAllByType('TextInput').find(n => n.props.placeholder === 'Seu nome').props.onChangeText('Pessoa Sintética');
    input(view, 'E-mail').props.onChangeText('synthetic@example.invalid');
    input(view, 'Senha').props.onChangeText('synthetic-password');
    input(view, 'Confirmar senha').props.onChangeText('synthetic-password');
  });
}
function assertNoTechnicalText(h, view) {
  const visible = texts(view) + JSON.stringify(h.calls.alerts.map(([title, message]) => [title, message]));
  assert.doesNotMatch(visible, /INTERNAL_TECHNICAL_ERROR|SECRET_DIAGNOSTIC|permission-denied|stack|Error:/);
}

test('cadastro completo exige estado completo e não permite outro envio', async () => {
  const h = harness(); const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    assert.ok(texts(page.view).includes('Perfil concluído.'));
    assert.equal(button(page.view, 'Perfil concluído').props.disabled, true);
    await press(page.view, 'Perfil concluído');
    assert.equal(h.calls.signup.length, 1); assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

test('cadastro parcial preserva formulário e recupera na mesma conta sem repetir criação', async () => {
  const h = harness(); h.handlers.signup = async () => result('parcial');
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    assert.match(texts(page.view), /Sua conta foi criada/);
    assert.equal(input(page.view, 'E-mail').props.value, 'synthetic@example.invalid');
    // Conclusão de perfil não usa senha: os campos ficam ocultos (o cadastro normal não muda).
    assert.equal(input(page.view, 'Senha'), undefined);
    assert.equal(input(page.view, 'Confirmar senha'), undefined);
    assert.equal(input(page.view, 'E-mail').props.editable, false);
    h.auth.user = syntheticUser; page.refresh();
    await press(page.view, 'Concluir meu perfil');
    assert.equal(h.calls.signup.length, 1); assert.equal(h.calls.recover.length, 1);
    assert.equal(h.calls.recover[0][0].nome, 'Pessoa Sintética');
    assert.equal(Object.hasOwn(h.calls.recover[0][0], 'senha'), false);
    assert.ok(button(page.view, 'Perfil concluído')); assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

for (const estado of ['parcial', 'falha']) {
  test(`recuperação ${estado} mantém recuperação disponível e não mostra sucesso`, async () => {
    const h = harness(); h.handlers.signup = async () => result('parcial'); h.handlers.recover = async () => result(estado);
    const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
    try {
      fillSignup(page.view); await press(page.view, 'Criar minha conta');
      h.auth.user = syntheticUser; page.refresh(); await press(page.view, 'Concluir meu perfil');
      assert.ok(button(page.view, 'Concluir meu perfil'));
      assert.equal(button(page.view, 'Perfil concluído'), undefined);
      assert.equal(h.calls.signup.length, 1); assertNoTechnicalText(h, page.view);
    } finally { page.unmount(); }
  });
}

test('cadastro com falha completa mantém valores e permite nova tentativa sem sucesso falso', async () => {
  const h = harness(); h.handlers.signup = async () => result('falha', { usuario: undefined });
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    assert.equal(input(page.view, 'E-mail').props.value, 'synthetic@example.invalid');
    assert.ok(button(page.view, 'Criar minha conta'));
    assert.equal(button(page.view, 'Perfil concluído'), undefined);
    assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

test('cadastro/recuperação bloqueiam clique duplicado mesmo antes de rerender', async () => {
  const h = harness(); let resolveSignup;
  h.handlers.signup = () => new Promise(resolve => { resolveSignup = resolve; });
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); const signup = button(page.view, 'Criar minha conta').props.onPress;
    await act(async () => { signup(); signup(); }); assert.equal(h.calls.signup.length, 1);
    await act(async () => resolveSignup(result('parcial')));
    h.auth.user = syntheticUser; page.refresh();
    let resolveRecovery; h.handlers.recover = () => new Promise(resolve => { resolveRecovery = resolve; });
    const recover = button(page.view, 'Concluir meu perfil').props.onPress;
    await act(async () => { recover(); recover(); }); assert.equal(h.calls.recover.length, 1);
    await act(async () => resolveRecovery(result('completo')));
  } finally { page.unmount(); }
});

test('recuperação recusa sessão ausente ou outra conta, sem recriar usuário', async () => {
  const h = harness(); h.handlers.signup = async () => result('parcial');
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    await press(page.view, 'Concluir meu perfil');
    assert.match(texts(page.view), /Entre novamente na mesma conta/);
    h.auth.user = { uid: 'other' }; page.refresh(); await press(page.view, 'Concluir meu perfil');
    assert.equal(h.calls.recover.length, 0); assert.equal(h.calls.signup.length, 1);
  } finally { page.unmount(); }
});

test('exceção inesperada em cadastro não revela erro técnico e libera tentativa', async () => {
  const h = harness(); h.handlers.signup = async () => { throw new Error('SECRET_DIAGNOSTIC'); };
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    assert.equal(button(page.view, 'Criar minha conta').props.disabled, false);
    assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

// Nativo: falha/parcial também abrem o alerta do sistema. Web: só o aviso persistente na tela
// (sem window.alert redundante). Nos dois, sucesso exige confirmação antes de navegar.
const avisoNaTela = view => view.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert' && node.props.accessibilityLiveRegion === 'polite');
for (const os of ['ios', 'web']) for (const estado of ['completo', 'parcial', 'falha']) {
  test(`editar perfil (${os}): ${estado} só navega depois de sucesso completo e confirmação`, async () => {
    const h = harness({ user: syntheticUser, os }); h.handlers.edit = async () => result(estado);
    const page = h.render('app/editar-perfil.tsx');
    try {
      act(() => input(page.view, 'Nome Completo').props.onChangeText('Rascunho'));
      await press(page.view, 'Salvar Alterações');
      assert.deepEqual(h.calls.routes, []);
      if (estado === 'completo') {
        assert.equal(h.calls.alerts.length, 1);
        assert.equal(h.calls.alerts[0][0], 'Sucesso');
        act(() => h.calls.alerts[0][2][0].onPress());
        assert.deepEqual(h.calls.routes, ['/perfil']);
        assert.equal(avisoNaTela(page.view).length, 0);
      } else {
        if (os === 'web') {
          assert.deepEqual(h.calls.alerts, []);
        } else {
          assert.equal(h.calls.alerts.length, 1);
          assert.notEqual(h.calls.alerts[0][0], 'Sucesso');
          assert.equal(h.calls.alerts[0][2], undefined);
        }
        assert.equal(avisoNaTela(page.view).length, 1);
        assert.match(texts(page.view), estado === 'parcial' ? /Alterações incompletas/ : /Não foi possível salvar/);
        assert.equal(input(page.view, 'Nome Completo').props.value, 'Rascunho');
      }
      assertNoTechnicalText(h, page.view);
    } finally { page.unmount(); }
  });
}

test('editar: snapshot tardio não sobrescreve rascunho nem tentativa após parcial', async () => {
  const h = harness({ user: syntheticUser }); h.handlers.edit = async () => result('parcial');
  const page = h.render('app/editar-perfil.tsx');
  try {
    act(() => input(page.view, 'Nome Completo').props.onChangeText('Rascunho'));
    h.auth.perfil = { ...h.auth.perfil, nome: 'Snapshot diferente', telefone: 'snapshot' }; page.refresh();
    assert.equal(input(page.view, 'Nome Completo').props.value, 'Rascunho');
    await press(page.view, 'Salvar Alterações');
    h.handlers.edit = async () => result('completo'); await press(page.view, 'Salvar Alterações');
    assert.equal(h.calls.edit.length, 2);
    assert.equal(h.calls.edit[0][0], 'Rascunho'); assert.equal(h.calls.edit[1][0], 'Rascunho');
  } finally { page.unmount(); }
});

test('editar: clique duplicado não envia duas operações', async () => {
  const h = harness({ user: syntheticUser }); let finish;
  h.handlers.edit = () => new Promise(resolve => { finish = resolve; });
  const page = h.render('app/editar-perfil.tsx');
  try {
    const save = button(page.view, 'Salvar Alterações').props.onPress;
    await act(async () => { save(); save(); }); assert.equal(h.calls.edit.length, 1);
    await act(async () => finish(result('parcial')));
  } finally { page.unmount(); }
});

test('cadastro: Enter e clique simultâneos usam a mesma trava de envio', async () => {
  const h = harness(); let finish;
  h.handlers.signup = () => new Promise(resolve => { finish = resolve; });
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view);
    const enter = input(page.view, 'Confirmar senha').props.onSubmitEditing;
    const click = button(page.view, 'Criar minha conta').props.onPress;
    await act(async () => { enter(); click(); });
    assert.equal(h.calls.signup.length, 1);
    await act(async () => finish(result('completo')));
  } finally { page.unmount(); }
});

test('recuperação rejeitada mantém CTA da mesma conta sem expor a exceção', async () => {
  const h = harness(); h.handlers.signup = async () => result('parcial');
  h.handlers.recover = async () => { throw new Error('SECRET_DIAGNOSTIC'); };
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    h.auth.user = syntheticUser; page.refresh(); await press(page.view, 'Concluir meu perfil');
    assert.equal(button(page.view, 'Concluir meu perfil').props.disabled, false);
    assert.equal(h.calls.signup.length, 1); assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

test('editar: resposta de outra sessão não apresenta sucesso nem navega', async () => {
  const h = harness({ user: syntheticUser }); let finish;
  h.handlers.edit = () => new Promise(resolve => { finish = resolve; });
  const page = h.render('app/editar-perfil.tsx');
  try {
    await press(page.view, 'Salvar Alterações');
    h.auth.user = { uid: 'other-user' }; page.refresh();
    await act(async () => finish(result('completo')));
    assert.deepEqual(h.calls.alerts, []); assert.deepEqual(h.calls.routes, []);
    await press(page.view, 'Salvar Alterações');
    assert.equal(h.calls.edit.length, 1);
  } finally { page.unmount(); }
});

test('editar: resposta após desmontagem não abre alerta', async () => {
  const h = harness({ user: syntheticUser }); let finish;
  h.handlers.edit = () => new Promise(resolve => { finish = resolve; });
  const page = h.render('app/editar-perfil.tsx');
  await press(page.view, 'Salvar Alterações'); page.unmount();
  await act(async () => finish(result('completo')));
  assert.deepEqual(h.calls.alerts, []); assert.deepEqual(h.calls.routes, []);
});

test('guard preserves pending signup until confirmed completion', () => {
  const h = harness(); h.auth.entry = 'cadastro'; h.auth.loading = false;
  const page = h.render('app/_layout.tsx');
  try {
    const routes = () => page.view.root.findAllByType('StackScreen').map(node => node.props.name);
    assert.ok(routes().includes('cadastro'));
    h.auth.user = syntheticUser; page.refresh();
    assert.ok(routes().includes('cadastro'));
    assert.equal(routes().includes('index'), false);
    h.auth.perfilConcluido = true; page.refresh();
    assert.equal(routes().includes('cadastro'), false);
    assert.ok(routes().includes('index'));
  } finally { page.unmount(); }
});

test('editar: rejeição mantém dados, não navega e permite tentar novamente', async () => {
  const h = harness({ user: syntheticUser }); h.handlers.edit = async () => { throw new Error('SECRET_DIAGNOSTIC'); };
  const page = h.render('app/editar-perfil.tsx');
  try {
    act(() => input(page.view, 'Nome Completo').props.onChangeText('Rascunho'));
    await press(page.view, 'Salvar Alterações');
    assert.equal(input(page.view, 'Nome Completo').props.value, 'Rascunho');
    assert.equal(button(page.view, 'Salvar Alterações').props.disabled, false);
    assert.deepEqual(h.calls.routes, []); assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

// --- Ajustes de interface: conclusão de perfil e aviso persistente na edição ---

test('conclusão de perfil usa textos de recuperação e oculta senhas; cadastro normal mantém tudo', async () => {
  const h = harness(); h.handlers.signup = async () => result('parcial');
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    assert.match(texts(page.view), /COMECE UMA NOVA HISTÓRIA/);
    assert.match(texts(page.view), /Crie sua conta/);
    assert.ok(input(page.view, 'Senha')); assert.ok(input(page.view, 'Confirmar senha'));
    fillSignup(page.view); await press(page.view, 'Criar minha conta');
    const t = texts(page.view);
    assert.match(t, /CONCLUSÃO DO PERFIL/); assert.match(t, /Conclua seu perfil/);
    assert.match(t, /sem criar outra conta nem informar a senha/);
    assert.doesNotMatch(t, /COMECE UMA NOVA HISTÓRIA|Cadastre-se para acompanhar/);
    assert.equal(input(page.view, 'Senha'), undefined);
    assert.equal(input(page.view, 'Confirmar senha'), undefined);
    // O rascunho da central continua em memória durante a mesma montagem: sem aviso de perda.
    assert.doesNotMatch(t, /não foi mantido/);
  } finally { page.unmount(); }
});

test('sessão restaurada sem central: avisa que pode vincular depois; com central salva, não avisa', async () => {
  const h = harness({ user: syntheticUser });
  const semCentral = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    assert.match(texts(semCentral.view), /Conclua seu perfil/);
    assert.equal(input(semCentral.view, 'Senha'), undefined);
    assert.match(texts(semCentral.view), /não foi mantido.*vincule a central depois, em Editar perfil/s);
  } finally { semCentral.unmount(); }
  h.auth.perfil = { ...h.auth.perfil, dispositivo_id: 'central-sintetica' };
  const comCentral = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try { assert.doesNotMatch(texts(comCentral.view), /não foi mantido/); } finally { comCentral.unmount(); }
});

test('cadastro novo em andamento com sessão recebida continua com aparência de cadastro', async () => {
  const h = harness(); let finish;
  h.handlers.signup = () => new Promise(resolve => { finish = resolve; });
  const page = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    fillSignup(page.view);
    await act(async () => { button(page.view, 'Criar minha conta').props.onPress(); });
    h.auth.user = syntheticUser; page.refresh();
    assert.match(texts(page.view), /Crie sua conta/);
    assert.ok(input(page.view, 'Senha'));
    await act(async () => finish(result('completo')));
    assert.match(texts(page.view), /Crie sua conta/);
    assert.ok(button(page.view, 'Perfil concluído'));
  } finally { page.unmount(); }
});

test('editar: aviso fica na tela após parcial/falha, atualiza na nova tentativa e some no sucesso', async () => {
  const h = harness({ user: syntheticUser }); h.handlers.edit = async () => result('parcial');
  const page = h.render('app/editar-perfil.tsx');
  try {
    act(() => input(page.view, 'Telefone').props.onChangeText('rascunho-telefone'));
    assert.doesNotMatch(texts(page.view), /Alterações incompletas/);
    await press(page.view, 'Salvar Alterações');
    assert.match(texts(page.view), /Alterações incompletas/);
    assert.equal(input(page.view, 'Telefone').props.value, 'rascunho-telefone');
    let finish; h.handlers.edit = () => new Promise(resolve => { finish = resolve; });
    await act(async () => { button(page.view, 'Salvar Alterações').props.onPress(); });
    assert.match(texts(page.view), /Tentando salvar novamente/);
    assert.doesNotMatch(texts(page.view), /Alterações incompletas/);
    await act(async () => finish(result('falha', { etapas: { conta: 'existente', auth: 'nao-confirmado', firestore: 'nao-executado' } })));
    assert.match(texts(page.view), /Não foi possível salvar/);
    assert.match(texts(page.view), /Resultado da tentativa 2\./);
    assert.equal(input(page.view, 'Telefone').props.value, 'rascunho-telefone');
    assert.deepEqual(h.calls.routes, []);
    h.handlers.edit = async () => result('completo');
    await press(page.view, 'Salvar Alterações');
    assert.doesNotMatch(texts(page.view), /Alterações incompletas|Não foi possível salvar|Tentando salvar/);
    assert.equal(h.calls.alerts.at(-1)[0], 'Sucesso');
    // Web: as três tentativas abriram um único alerta, o de sucesso.
    assert.equal(h.calls.alerts.length, 1);
    assertNoTechnicalText(h, page.view);
  } finally { page.unmount(); }
});

// --- Pendências finais: rolagem até o aviso, alerta só no nativo e saída na conclusão ---

for (const os of ['ios', 'web']) {
  test(`editar (${os}): exceção mostra aviso na tela; alerta do sistema só no nativo`, async () => {
    const h = harness({ user: syntheticUser, os }); h.handlers.edit = async () => { throw new Error('SECRET_DIAGNOSTIC'); };
    const page = h.render('app/editar-perfil.tsx');
    try {
      await press(page.view, 'Salvar Alterações');
      assert.equal(avisoNaTela(page.view).length, 1);
      assert.equal(h.calls.alerts.length, os === 'web' ? 0 : 1);
      assertNoTechnicalText(h, page.view);
    } finally { page.unmount(); }
  });
}

function editarComRolagem(h) {
  const rolagens = [];
  const page = h.render('app/editar-perfil.tsx', {}, { createNodeMock: el => el.type === 'ScrollView'
    ? { scrollToEnd: opcoes => rolagens.push(opcoes), scrollTo() {} } : null });
  const sv = () => page.view.root.findAllByType('ScrollView')[0];
  const medir = ({ altura, conteudo, deslocamento = 0 }) => act(() => {
    sv().props.onLayout({ nativeEvent: { layout: { height: altura } } });
    sv().props.onScroll({ nativeEvent: { contentOffset: { y: deslocamento } } });
    sv().props.onContentSizeChange(390, conteudo);
  });
  return { page, rolagens, sv, medir };
}

test('editar: ao surgir o aviso fora da área visível, rola até o aviso e o botão de salvar', async () => {
  const h = harness({ user: syntheticUser }); h.handlers.edit = async () => result('parcial');
  const { page, rolagens, medir, sv } = editarComRolagem(h);
  try {
    // Área visível de 500 px (ex.: teclado aberto), rolada até o fim antes de salvar.
    medir({ altura: 500, conteudo: 1400, deslocamento: 900 });
    act(() => input(page.view, 'Telefone').props.onChangeText('rascunho'));
    assert.deepEqual(rolagens, [], 'digitar não rola a tela');
    await press(page.view, 'Salvar Alterações');
    // O aviso aumenta o conteúdo e empurra o botão para fora da área visível.
    act(() => sv().props.onContentSizeChange(390, 1520));
    assert.deepEqual(rolagens, [{ animated: true }]);
    assert.equal(input(page.view, 'Telefone').props.value, 'rascunho');
    // Mudanças de layout posteriores (edição) não voltam a rolar.
    act(() => sv().props.onContentSizeChange(390, 1530));
    assert.equal(rolagens.length, 1);
  } finally { page.unmount(); }
});

test('editar: aviso já visível não força rolagem', async () => {
  const h = harness({ user: syntheticUser }); h.handlers.edit = async () => result('falha');
  const { page, rolagens, medir, sv } = editarComRolagem(h);
  try {
    medir({ altura: 800, conteudo: 1400, deslocamento: 800 });
    await press(page.view, 'Salvar Alterações');
    act(() => sv().props.onContentSizeChange(390, 1520));
    assert.deepEqual(rolagens, []);
  } finally { page.unmount(); }
});

test('editar: conteúdo envolvido por KeyboardAvoidingView para o teclado não cobrir aviso e botão', () => {
  const h = harness({ user: syntheticUser, os: 'ios' });
  const page = h.render('app/editar-perfil.tsx');
  try {
    const kav = page.view.root.findByType('KeyboardAvoidingView');
    assert.equal(kav.props.behavior, 'padding');
    assert.ok(button({ root: kav.findByType('ScrollView') },'Salvar Alterações'));
  } finally { page.unmount(); }
});

test('conclusão de perfil: sem botão voltar; saída clara pelo fluxo existente', async () => {
  const h = harness(); let saidas = 0; h.auth.sairDaConta = async () => { saidas += 1; };
  const voltar = view => view.root.findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel === 'Voltar para as boas-vindas');
  const normal = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    assert.equal(voltar(normal.view).length, 1, 'cadastro normal mantém o voltar');
    assert.equal(button(normal.view, 'Sair da conta'), undefined);
  } finally { normal.unmount(); }
  h.auth.user = syntheticUser;
  const conclusao = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try {
    assert.match(texts(conclusao.view), /Conclua seu perfil/);
    assert.equal(voltar(conclusao.view).length, 0);
    const sair = button(conclusao.view, 'Sair da conta');
    assert.equal(sair.props.accessibilityRole, 'button');
    assert.notEqual(sair.props.disabled, true);
    assert.match(texts(conclusao.view), /entrar novamente depois e concluir o perfil/);
    await press(conclusao.view, 'Sair da conta');
    assert.equal(saidas, 1);
  } finally { conclusao.unmount(); }
  h.auth.saindo = true;
  const saindo = h.render('components/AuthScreen.tsx', { mode: 'cadastro' });
  try { assert.equal(button(saindo.view, 'Saindo…').props.disabled, true); } finally { saindo.unmount(); }
});

test('login mantém o voltar e não exibe saída', () => {
  const h = harness();
  const page = h.render('components/AuthScreen.tsx', { mode: 'login' });
  try {
    assert.equal(page.view.root.findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel === 'Voltar para as boas-vindas').length, 1);
    assert.equal(button(page.view, 'Sair da conta'), undefined);
  } finally { page.unmount(); }
});
