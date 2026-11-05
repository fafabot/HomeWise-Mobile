// Testes focados nas correções de front-end do experimento visual.
// Renderizam as telas reais com Auth/services falsos; nunca acessam o Firebase.
// Rodar: node --test tests/experimento-visual.test.cjs  (ou npm test)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { test, mock } = require('node:test');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;

function harness({ perfil = {}, dispositivoId = 'central_teste', auth = {}, router = {}, params = {} } = {}) {
  const chamadas = { cancelar: 0, ativar: [], rotas: [] };
  const fakeRouter = {
    push: rota => chamadas.rotas.push(['push', rota]),
    replace: rota => chamadas.rotas.push(['replace', rota]),
    back: () => chamadas.rotas.push(['back']),
    canGoBack: () => true,
    ...router,
  };
  const valorAuth = {
    user: { uid: 'u', email: 'teste@exemplo.com' },
    perfil: { plano: 'plus', status_assinatura: 'ativa', ciclo_assinatura: 'mensal', nome: 'Teste', ...perfil },
    dispositivoId,
    selectEntry() {},
    cancelarAssinatura: async () => { chamadas.cancelar++; return true; },
    atualizarPlanoAssinatura: async (id, ciclo) => { chamadas.ativar.push([id, ciclo]); return true; },
    ...auth,
  };
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'TouchableOpacity', 'View', 'Image'].map(n => [n, n]));
  native.StyleSheet = { create: s => s, absoluteFill: {} };
  native.Platform = { OS: 'web' };
  const deps = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => fakeRouter, useLocalSearchParams: () => params },
    'expo-web-browser': { openBrowserAsync: async () => {} },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path', Rect: 'Rect' },
    'firebase/auth': { sendPasswordResetEmail: async () => {} },
    '@/contexts/AuthContext': { useAuth: () => valorAuth },
    '@/services/authService': { deslogarUsuario: async () => {}, recuperarSenha: async () => ({ sucesso: true }), ...auth.authService },
    '@/services/authErrors': { authErrorMessage: () => 'erro' },
    '@/services/firebase': { auth: {} },
    '@/components/ProfilePhoto': { __esModule: true, default: 'ProfilePhoto' },
    '@/components/HomeWiseLogo': { __esModule: true, default: 'HomeWiseLogo' },
  };
  const cache = {};
  function load(relativo) {
    if (cache[relativo]) return cache[relativo];
    const js = ts.transpileModule(readFileSync(path.join(__dirname, '../src', relativo), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const modulo = { exports: {} };
    new Function('module', 'exports', 'require', js)(modulo, modulo.exports, nome => {
      if (Object.hasOwn(deps, nome)) return deps[nome];
      if (nome.startsWith('@/')) {
        const alvo = nome.slice(2);
        return load(alvo + (existsSync(path.join(__dirname, '../src', alvo + '.ts')) ? '.ts' : '.tsx'));
      }
      throw new Error(`Dependência inesperada: ${nome}`);
    });
    return (cache[relativo] = modulo.exports);
  }
  return { load, chamadas };
}

const texto = no => [].concat(no.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join('');
const textos = view => view.root.findAllByType('Text').map(texto);
const botao = (view, rotulo) => view.root.findAllByType('TouchableOpacity').find(b => b.findAllByType('Text').some(t => texto(t) === rotulo));
function render(Tela) {
  let view;
  act(() => { view = Renderer.create(React.createElement(Tela)); });
  return view;
}
/** Nós que não são <Text> e recebem texto/número solto: no react-native-web vira "Unexpected text node". */
function textoSolto(view) {
  return view.root.findAll(n => typeof n.type === 'string' && !['Text', 'TextInput'].includes(n.type)
    && [].concat(n.props.children ?? []).flat(9).some(c => typeof c === 'string' || typeof c === 'number'));
}

test('perfil sem central vinculada não coloca texto vazio dentro de View', () => {
  const h = harness({ dispositivoId: '' });
  const view = render(h.load('app/perfil.tsx').default);
  try {
    assert.deepEqual(textoSolto(view).map(n => n.type), []);
  } finally { act(() => view.unmount()); }
});

test('perfil: "Plano e assinatura" abre Gerenciar assinatura sem checkout', () => {
  const h = harness();
  const view = render(h.load('app/perfil.tsx').default);
  try {
    const item = view.root.findAllByType('TouchableOpacity').find(b => String(b.props.accessibilityLabel).startsWith('Plano e assinatura'));
    act(() => item.props.onPress());
    assert.deepEqual(h.chamadas.rotas, [['push', '/gerenciar-assinatura']]);
  } finally { act(() => view.unmount()); }
});

test('gerenciar: Cancelar pede confirmação antes de cancelar', async () => {
  const h = harness();
  const view = render(h.load('app/gerenciar-assinatura.tsx').default);
  try {
    act(() => botao(view, 'Cancelar').props.onPress());
    assert.equal(h.chamadas.cancelar, 0, 'não cancela no primeiro toque');
    assert.ok(textos(view).includes('Cancelar assinatura?'));
    act(() => botao(view, 'Manter plano').props.onPress());
    assert.equal(h.chamadas.cancelar, 0);
    assert.equal(textos(view).includes('Cancelar assinatura?'), false);
    act(() => botao(view, 'Cancelar').props.onPress());
    await act(async () => { botao(view, 'Confirmar cancelamento').props.onPress(); });
    assert.equal(h.chamadas.cancelar, 1);
    assert.ok(textos(view).includes('Sua assinatura foi cancelada.'));
  } finally { act(() => view.unmount()); }
});

test('gerenciar: falha ao cancelar mantém a confirmação aberta com erro', async () => {
  const h = harness({ auth: { cancelarAssinatura: async () => false } });
  const view = render(h.load('app/gerenciar-assinatura.tsx').default);
  try {
    act(() => botao(view, 'Cancelar').props.onPress());
    await act(async () => { botao(view, 'Confirmar cancelamento').props.onPress(); });
    assert.ok(textos(view).includes('Cancelar assinatura?'));
    const alerta = view.root.findAll(n => n.type === 'Text' && n.props.accessibilityRole === 'alert');
    assert.ok(alerta.some(n => texto(n) === 'Não foi possível cancelar a assinatura.'));
  } finally { act(() => view.unmount()); }
});

test('gerenciar: voltar retorna à tela anterior; sem histórico vai ao Perfil', () => {
  for (const [podeVoltar, esperado] of [[true, ['back']], [false, ['replace', '/perfil']]]) {
    const h = harness({ router: { canGoBack: () => podeVoltar } });
    // SubscriptionScreen real recebe onBack: localizamos pela prop
    const view = render(h.load('app/gerenciar-assinatura.tsx').default);
    try {
      const voltar = view.root.findAllByType('TouchableOpacity').find(b => b.props.accessibilityLabel === 'Voltar');
      act(() => voltar.props.onPress());
      assert.deepEqual(h.chamadas.rotas, [esperado]);
    } finally { act(() => view.unmount()); }
  }
});

test('gerenciar: confirmação de pagamento simulado some em 5 s e não volta ao reabrir', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const h = harness({ perfil: { plano: 'basico' }, params: { checkout: 'plus' } });
    const Tela = h.load('app/gerenciar-assinatura.tsx').default;
    const view = render(Tela);
    act(() => botao(view, 'Simular pagamento PIX e ativar').props.onPress());
    await act(async () => { mock.timers.tick(900); for (let i = 0; i < 4; i++) await Promise.resolve(); });
    assert.deepEqual(h.chamadas.ativar, [['plus', 'mensal']]);
    assert.ok(textos(view).includes('Pagamento aprovado'));
    assert.ok(textos(view).includes('SIMULAÇÃO'));
    act(() => mock.timers.tick(4999));
    assert.ok(textos(view).includes('Pagamento aprovado'));
    act(() => mock.timers.tick(1));
    assert.equal(textos(view).includes('Pagamento aprovado'), false);
    assert.ok(botao(view, 'Cancelar'), 'cartão da assinatura atual mantém o botão Cancelar');
    act(() => view.unmount());
    const reaberta = render(Tela);
    assert.equal(textos(reaberta).includes('Pagamento aprovado'), false);
    act(() => reaberta.unmount());
  } finally { mock.timers.reset(); }
});

test('plano-assinatura: falha ao cancelar mostra erro e não fecha o modal', async () => {
  const h = harness({ auth: { cancelarAssinatura: async () => false } });
  const view = render(h.load('app/plano-assinatura.tsx').default);
  try {
    act(() => botao(view, 'Cancelar assinatura').props.onPress());
    await act(async () => { botao(view, 'Confirmar cancelamento').props.onPress(); });
    assert.equal(view.root.findByType('Modal').props.visible, true);
    assert.ok(textos(view).some(t => t.startsWith('Não foi possível cancelar a assinatura.')));
  } finally { act(() => view.unmount()); }
});

test('recuperar senha usa recuperarSenha do authService e não revela conta inexistente', async () => {
  const pedidos = [];
  for (const [resposta, esperado] of [
    [{ sucesso: false, erro: 'Nenhuma conta', codigo: 'auth/user-not-found' }, 'enviado'],
    [{ sucesso: false, erro: 'x', codigo: 'auth/network-request-failed' }, 'erro'],
  ]) {
    const h = harness({ auth: { authService: { recuperarSenha: async (email) => { pedidos.push(email); return resposta; } } } });
    const view = render(h.load('app/recuperar-senha.tsx').default);
    try {
      act(() => view.root.findByType('TextInput').props.onChangeText('  Pessoa@Exemplo.com '));
      await act(async () => { botao(view, 'Enviar link').props.onPress(); });
      const enviado = textos(view).some(t => t.startsWith('Se houver uma conta com esse e-mail'));
      const erro = view.root.findAll(n => n.type === 'Text' && n.props.accessibilityRole === 'alert').length > 0;
      assert.equal(enviado ? 'enviado' : erro ? 'erro' : '?', esperado);
    } finally { act(() => view.unmount()); }
  }
  assert.deepEqual(pedidos, ['pessoa@exemplo.com', 'pessoa@exemplo.com']);
});

test('recuperar senha: voltar ao login retorna à tela existente em vez de empilhar outra', () => {
  const h = harness({ dispositivoId: '' });
  const view = render(h.load('app/recuperar-senha.tsx').default);
  try {
    act(() => botao(view, 'Voltar para o login').props.onPress());
    assert.deepEqual(h.chamadas.rotas, [['back']]);
  } finally { act(() => view.unmount()); }
});
