globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;

// Gerenciar assinatura com contexto, rotas e telas nativas falsos. Nunca contata Firebase nem ViaCEP.
const PERFIL_SEM_PLANO = {
  nome: 'Pessoa Sintética', cpf: '529.982.247-25', telefone: '(11) 98888-7777', cep: '01001-000',
  endereco_detalhado: { rua: 'Rua Sintética', numero: '10', complemento: '', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' },
  plano: null, status_assinatura: 'cancelada', ciclo_assinatura: 'mensal',
};

function harness({ os = 'web', params = {} } = {}) {
  let perfil = { ...PERFIL_SEM_PLANO };
  let subscriptionState = 'pronta';
  const calls = { planos: [], cancelamentos: 0, rolagens: [], anuncios: [], setParams: [] };
  const handlers = { atualizar: async () => true };
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'ScrollView', 'StatusBar',
    'Text', 'TextInput', 'TouchableOpacity', 'View'].map(n => [n, n]));
  native.StyleSheet = { create: v => v, absoluteFill: {} };
  native.Platform = { OS: os };
  native.AccessibilityInfo = { announceForAccessibility: texto => calls.anuncios.push(texto) };
  const auth = () => ({
    assinaturaPendente: false,
    assinaturaEstado: subscriptionState, assinaturaMensagem: '', assinaturaEscritaLiberada: true,
    user: { uid: 'synthetic-user', displayName: 'Pessoa Sintética' }, perfil,
    atualizarPlanoAssinatura: async (...args) => {
      calls.planos.push(args); const ok = await handlers.atualizar(...args);
      if (ok === true) perfil = { ...perfil, plano: args[0], ciclo_assinatura: args[1], status_assinatura: 'ativa' };
      return ok;
    },
    cancelarAssinatura: async () => { calls.cancelamentos += 1; return true; },
  });
  const deps = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': {
      useRouter: () => ({ push() {}, replace() {}, back() {}, canGoBack: () => false, setParams: p => calls.setParams.push(p) }),
      useLocalSearchParams: () => params,
    },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path', Rect: 'Rect' },
    '@/contexts/AuthContext': { useAuth: auth },
  };
  const cache = {};
  function load(relative) {
    if (cache[relative]) return cache[relative];
    const compiled = ts.transpileModule(readFileSync(path.join(__dirname, '../src', relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('module', 'exports', 'require', compiled)(module, module.exports, name => {
      if (Object.hasOwn(deps, name)) return deps[name];
      if (name.startsWith('@/')) {
        const alvo = name.slice(2);
        return load(alvo + (existsSync(path.join(__dirname, '../src', alvo + '.ts')) ? '.ts' : '.tsx'));
      }
      throw new Error(`Dependência bloqueada (sem SDK/rede): ${name}`);
    });
    return (cache[relative] = module.exports);
  }
  const modulo = load('app/gerenciar-assinatura.tsx');
  let view;
  const opcoes = { createNodeMock: el => el.type === 'ScrollView' ? { scrollTo: o => calls.rolagens.push(o) } : null };
  function render() { act(() => { view = Renderer.create(React.createElement(modulo.default), opcoes); }); return view; }
  return {
    calls, handlers, modulo, render,
    rerender: () => act(() => view.update(React.createElement(modulo.default))),
    setPerfil: p => { perfil = p; },
    setSubscriptionState: value => { subscriptionState = value; },
    get view() { return view; },
  };
}

const textoDe = n => [].concat(n.props.children).filter(c => typeof c === 'string' || typeof c === 'number').join('');
const textos = view => view.root.findAllByType('Text').map(textoDe).join('\n');
const botao = (view, rotulo) => view.root.findAllByType('TouchableOpacity')
  .find(n => n.props.accessibilityLabel === rotulo || n.findAllByType('Text').some(t => textoDe(t) === rotulo));
const modalVisivel = view => view.root.findByType('Modal').props.visible;
const cartao = view => textos(view).match(/SUA ASSINATURA ATUAL\n(.*)/)[1];
const confirmacao = view => view.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'alert' && /Simulação concluída/.test(n.props.accessibilityLabel || ''));

async function contratar(t, h, { ciclo = 'mensal', plano = 'Plus' } = {}) {
  const view = h.view;
  if (ciclo === 'anual') act(() => botao(view, 'Anual').props.onPress());
  act(() => botao(view, `Escolher plano ${plano}`).props.onPress());
  assert.equal(modalVisivel(view), true);
  await act(async () => { botao(view, 'Simular pagamento PIX e ativar').props.onPress(); });
  // Tempo simulado de aprovação (900 ms) e depois a resposta do contexto
  await act(async () => { t.mock.timers.tick(900); });
  await act(async () => {});
}

test('sucesso: fecha o checkout, atualiza o cartão, rola ao topo e confirma por 5 s', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const view = h.render();
  try {
    assert.equal(cartao(view), 'Sem plano contratado');
    assert.equal(botao(view, 'Cancelar assinatura'), undefined);
    await contratar(t, h, { ciclo: 'anual' });
    assert.deepEqual(h.calls.planos.map(([id, ciclo]) => [id, ciclo]), [['plus', 'anual']]);
    assert.equal(modalVisivel(view), false);
    // O snapshot do perfil ainda não chegou: o cartão já mostra o plano e o ciclo confirmados
    assert.equal(cartao(view), 'HomeWise Plus (Anual)');
    assert.ok(botao(view, 'Cancelar assinatura'));
    assert.deepEqual(h.calls.rolagens, [{ y: 0, animated: true }]);
    assert.match(textos(view), /Simulação concluída: plano HomeWise Plus anual ativado\./);
    const aviso = confirmacao(view);
    assert.equal(aviso.length, 1);
    assert.equal(aviso[0].props.accessibilityLiveRegion, 'polite');
    assert.match(aviso[0].props.accessibilityLabel, /^Simulação concluída: plano HomeWise Plus anual ativado\. .*nenhuma cobrança real/);
    assert.deepEqual(h.calls.anuncios, [], 'web anuncia por role="alert"');
    assert.deepEqual(h.calls.setParams, []);

    await act(async () => { t.mock.timers.tick(4999); });
    assert.equal(confirmacao(view).length, 1);
    await act(async () => { t.mock.timers.tick(1); });
    assert.equal(confirmacao(view).length, 0);
    assert.doesNotMatch(textos(view), /Simulação concluída/);
    assert.equal(cartao(view), 'HomeWise Plus (Anual)');
    assert.ok(botao(view, 'Cancelar assinatura'));
    assert.equal(h.calls.rolagens.length, 1);

    // O snapshot chega depois: continua igual, agora vindo do perfil
    h.setPerfil({ ...PERFIL_SEM_PLANO, plano: 'plus', status_assinatura: 'ativa', ciclo_assinatura: 'anual' });
    h.rerender();
    assert.equal(cartao(view), 'HomeWise Plus (Anual)');
    assert.doesNotMatch(textos(view), /Simulação concluída/);
  } finally { act(() => view.unmount()); }
});

test('sucesso no nativo: confirmação também anunciada ao leitor de tela', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ os: 'ios' });
  const view = h.render();
  try {
    await contratar(t, h);
    assert.equal(cartao(view), 'HomeWise Plus (Mensal)');
    assert.deepEqual(h.calls.anuncios, ['Simulação concluída: plano HomeWise Plus mensal ativado. Nenhuma cobrança real foi feita.']);
  } finally { act(() => view.unmount()); }
});

for (const [caso, atualizar] of [['retorno false', async () => false], ['exceção', async () => { throw new Error('SECRET_DIAGNOSTIC'); }]]) {
  test(`falha (${caso}): mantém o checkout com erro, sem confirmar, rolar ou mudar o cartão`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = harness({ os: 'ios' }); h.handlers.atualizar = atualizar;
    const view = h.render();
    try {
      await contratar(t, h);
      assert.equal(modalVisivel(view), true);
      assert.match(textos(view), /Não foi possível confirmar a ativação/);
      assert.doesNotMatch(textos(view), /Simulação concluída|SECRET_DIAGNOSTIC/);
      assert.equal(confirmacao(view).length, 0);
      assert.deepEqual(h.calls.rolagens, []);
      assert.deepEqual(h.calls.anuncios, []);
      assert.equal(cartao(view), 'Sem plano contratado');
      assert.equal(botao(view, 'Simular pagamento PIX e ativar').props.disabled, false, 'permite tentar de novo');
      await act(async () => { t.mock.timers.tick(5000); });
      assert.equal(modalVisivel(view), true);
    } finally { act(() => view.unmount()); }
  });
}

test('voltar à tela ou recarregar não reapresenta a confirmação', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const view = h.render();
  await contratar(t, h);
  assert.equal(confirmacao(view).length, 1);
  act(() => view.unmount());
  h.setPerfil({ ...PERFIL_SEM_PLANO, plano: 'plus', status_assinatura: 'ativa', ciclo_assinatura: 'mensal' });
  const nova = h.render();
  try {
    assert.equal(cartao(nova), 'HomeWise Plus (Mensal)');
    assert.ok(botao(nova, 'Cancelar assinatura'));
    assert.equal(confirmacao(nova).length, 0);
    assert.doesNotMatch(textos(nova), /Simulação concluída/);
  } finally { act(() => nova.unmount()); }
});

test('checkout aberto por link: após sucesso remove o parâmetro para a recarga não reabrir', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ params: { checkout: 'premium' } });
  const view = h.render();
  try {
    assert.equal(modalVisivel(view), true);
    await act(async () => { botao(view, 'Simular pagamento PIX e ativar').props.onPress(); });
    await act(async () => { t.mock.timers.tick(900); });
    await act(async () => {});
    assert.equal(modalVisivel(view), false);
    assert.deepEqual(h.calls.setParams, [{ checkout: undefined }]);
    assert.match(textos(view), /Simulação concluída: plano HomeWise Premium mensal ativado\./);
  } finally { act(() => view.unmount()); }
});

test('resposta depois de sair da tela não cria confirmação, rolagem nem temporizador', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness({ os: 'ios' }); let concluir;
  h.handlers.atualizar = () => new Promise(r => { concluir = r; });
  const view = h.render();
  act(() => botao(view, 'Escolher plano Plus').props.onPress());
  await act(async () => { botao(view, 'Simular pagamento PIX e ativar').props.onPress(); });
  await act(async () => { t.mock.timers.tick(900); });
  act(() => view.unmount());
  await act(async () => { concluir(true); });
  assert.deepEqual(h.calls.rolagens, []);
  assert.deepEqual(h.calls.anuncios, []);
});

test('perfil confirmado pelo contexto depois da contratação prevalece (versão mais nova)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const view = h.render();
  try {
    await contratar(t, h);
    assert.equal(cartao(view), 'HomeWise Plus (Mensal)');
    h.setPerfil({ ...PERFIL_SEM_PLANO }); h.rerender();
    assert.equal(cartao(view), 'Sem plano contratado');
  } finally { act(() => view.unmount()); }
});

test('texto da confirmação usa nome e ciclo recebidos', () => {
  const { textoConfirmacaoContratacao } = harness().modulo;
  assert.equal(textoConfirmacaoContratacao('Plus', 'mensal'), 'Simulação concluída: plano HomeWise Plus mensal ativado.');
  assert.equal(textoConfirmacaoContratacao('Básico', 'anual'), 'Simulação concluída: plano HomeWise Básico anual ativado.');
});

test('timeout means pending, permits closing, never cancels or resubmits, late success still confirms for five seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); let resolve;
  h.handlers.atualizar = () => new Promise(yes => { resolve = yes; });
  const view = h.render();
  try {
    await contratar(t, h);
    await act(async () => { t.mock.timers.tick(10000); });
    assert.match(textos(view), /prazo não cancela/);
    assert.equal(confirmacao(view).length, 0); assert.equal(cartao(view), 'Sem plano contratado');
    assert.equal(botao(view, 'Fechar pagamento').props.disabled, false);
    act(() => botao(view, 'Fechar pagamento').props.onPress());
    assert.equal(modalVisivel(view), false); assert.equal(h.calls.planos.length, 1);
    await act(async () => resolve(true));
    assert.equal(cartao(view), 'HomeWise Plus (Mensal)'); assert.equal(confirmacao(view).length, 1);
    assert.deepEqual(h.calls.rolagens, [{ y: 0, animated: true }]);
    await act(async () => { t.mock.timers.tick(5000); });
    assert.equal(confirmacao(view).length, 0);
  } finally { act(() => view.unmount()); }
});

test('inconsistency clears an existing success toast and reconciliation does not replay it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(); const view = h.render();
  try {
    await contratar(t, h); assert.equal(confirmacao(view).length, 1);
    h.setSubscriptionState('inconsistente'); h.rerender();
    assert.equal(confirmacao(view).length, 0); assert.equal(cartao(view), 'Assinatura em verificação');
    h.setSubscriptionState('pronta'); h.rerender(); assert.equal(confirmacao(view).length, 0);
  } finally { act(() => view.unmount()); }
});
