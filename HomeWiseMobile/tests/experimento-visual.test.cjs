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

function harness({ perfil = {}, dispositivoId = 'central_teste', auth = {}, router = {}, params = {}, extras = {} } = {}) {
  const chamadas = { cancelar: 0, ativar: [], dadosAssinatura: [], rotas: [] };
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
    atualizarPlanoAssinatura: async (id, ciclo, dados) => {
      chamadas.ativar.push([id, ciclo]); chamadas.dadosAssinatura.push(dados); return true;
    },
    ...auth,
  };
  const native = Object.fromEntries(['ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'TouchableOpacity', 'View', 'Image'].map(n => [n, n]));
  native.StyleSheet = { create: s => s, absoluteFill: {} };
  native.Platform = { OS: 'web' };
  class ValorAnimado { constructor(v) { this.v = v; } setValue(v) { this.v = v; } interpolate({ outputRange }) { return outputRange[1]; } }
  native.Animated = { Value: ValorAnimado, View: 'Animated.View', timing: () => ({ start() {}, stop() {} }) };
  native.Easing = { out: () => 0, cubic: 0 };
  native.AccessibilityInfo = { isReduceMotionEnabled: () => new Promise(() => {}), addEventListener: () => ({ remove() {} }) };
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
    '@/components/AvisoFalhaLeituras': { __esModule: true, default: 'AvisoFalhaLeituras', SeloDesatualizado: 'SeloDesatualizado' },
    ...extras,
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
    // Cadastro sintético completo exigido pela main atual; nenhum CEP/API é consultado.
    const h = harness({ perfil: {
      plano: 'basico', nome: 'Morador de Teste', cpf: '52998224725', telefone: '11999990000', cep: '00000000',
      endereco_detalhado: { rua: 'Rua Sintética', numero: '123', bairro: 'Teste', cidade: 'Cidade Teste', estado: 'SP' },
    }, params: { checkout: 'plus' } });
    const Tela = h.load('app/gerenciar-assinatura.tsx').default;
    const view = render(Tela);
    act(() => botao(view, 'Simular pagamento PIX e ativar').props.onPress());
    await act(async () => { mock.timers.tick(900); for (let i = 0; i < 4; i++) await Promise.resolve(); });
    assert.deepEqual(h.chamadas.ativar, [['plus', 'mensal']]);
    assert.equal(h.chamadas.dadosAssinatura[0].nome, 'Morador de Teste');
    assert.equal(h.chamadas.dadosAssinatura[0].endereco_detalhado.rua, 'Rua Sintética');
    assert.equal(h.chamadas.dadosAssinatura[0].metodo_pagamento, 'pix');
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

test('gerenciar: cadastro incompleto não ativa plano nem remove validações posteriores da main', () => {
  const h = harness({ perfil: { plano: 'basico', cpf: '' }, params: { checkout: 'plus' } });
  const view = render(h.load('app/gerenciar-assinatura.tsx').default);
  try {
    act(() => botao(view, 'Simular pagamento PIX e ativar').props.onPress());
    assert.deepEqual(h.chamadas.ativar, []);
    assert.ok(textos(view).includes('Informe um CPF válido (11 dígitos).'));
  } finally { act(() => view.unmount()); }
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

test('gráfico: altura segue a escala real e zero medido não vira barra', () => {
  const { tipoBarra, alturaBarra } = harness().load('components/hw/GraficoBarras.tsx');
  assert.equal(tipoBarra(null), 'sem-leitura');
  assert.equal(tipoBarra(0), 'zero');
  assert.equal(tipoBarra(0.4), 'positivo');
  assert.equal(alturaBarra(null, 1), 0);
  assert.equal(alturaBarra(0, 40.2), 0, 'zero medido não recebe altura mínima');
  assert.equal(alturaBarra(40.2, 40.2), 150);
  assert.equal(alturaBarra(20.1, 40.2), 75);
  // Água com vazão baixa: escala própria (mínimo 1), sem imitar a altura de Energia
  assert.equal(alturaBarra(0.5, 1), 75);
  assert.equal(alturaBarra(0.01, 1), 4, 'positivo muito pequeno continua visível');
});

test('gráfico: diferencia zero medido de período sem leitura (Dia, Semana, Mês e Ano)', () => {
  const { default: Grafico, textoValorDetalhe } = harness().load('components/hw/GraficoBarras.tsx');
  const conjuntos = {
    dia: [{ label: 'Anteontem', valor: null }, { label: 'Ontem', valor: 0 }, { label: 'Hoje', valor: 2.5 }],
    semana: [{ label: 'Há 2 semanas', valor: 1.2 }, { label: 'Semana passada', valor: null }, { label: 'Esta semana', valor: 0 }],
    mes: ['jun', 'jul', 'ago', 'set', 'out', 'nov'].map((label, i) => ({ label, valor: i % 2 ? null : i * 0.3 })),
    ano: [2022, 2023, 2024, 2025, 2026].map((ano, i) => ({ label: String(ano), valor: i === 4 ? 0 : null })),
  };
  for (const [periodo, barras] of Object.entries(conjuntos)) {
    const maior = Math.max(...barras.map(b => b.valor ?? 0), 1);
    let view;
    act(() => { view = Renderer.create(React.createElement(Grafico, { barras, maior, cor: '#38bdf8', casas: 1, unidade: 'L/min', chaveAnimacao: periodo })); });
    try {
      const colunas = view.root.findAll(n => n.type === 'View' && n.props.accessible && typeof n.props.accessibilityLabel === 'string');
      assert.equal(colunas.length, barras.length, periodo);
      barras.forEach((b, i) => {
        const rotulo = colunas[i].props.accessibilityLabel;
        if (b.valor === null) assert.equal(rotulo, `${b.label.charAt(0).toUpperCase() + b.label.slice(1)}: sem leituras`);
        else if (b.valor === 0) assert.equal(rotulo, `${b.label.charAt(0).toUpperCase() + b.label.slice(1)}: 0 L/min, medido`);
        else assert.equal(rotulo, `${b.label.charAt(0).toUpperCase() + b.label.slice(1)}: ${textoValorDetalhe(b.valor)} L/min`);
        const animadas = colunas[i].findAllByType('Animated.View');
        assert.equal(animadas.length, b.valor > 0 ? 1 : 0, `${periodo}/${b.label}: só valor positivo tem barra`);
      });
      const legendas = textos(view);
      assert.equal(legendas.includes('0 medido'), barras.some(b => b.valor === 0), periodo);
      assert.equal(legendas.includes('Sem leitura no período'), barras.some(b => b.valor === null), periodo);
    } finally { act(() => view.unmount()); }
  }
});

// ---------- Interação com as barras (dados simulados) ----------

test('balão: precisão para valores pequenos e posição dentro das bordas', () => {
  const { textoValorDetalhe, textoValorBarra, posicaoBalao } = harness().load('components/hw/GraficoBarras.tsx');
  assert.equal(textoValorDetalhe(0), '0');
  assert.equal(textoValorDetalhe(0.034), '0.034');
  assert.equal(textoValorDetalhe(0.0021), '0.0021');
  assert.equal(textoValorDetalhe(4.5), '4.5', 'sem zeros à direita');
  assert.equal(textoValorDetalhe(88.4), '88.4');
  assert.equal(textoValorDetalhe(4298.3), '4298.3');
  assert.equal(textoValorBarra(0.034, 1), '<0.1', 'positivo pequeno não aparece como 0.0 na barra');
  assert.equal(textoValorBarra(0, 1), '0.0');
  // 350 px, 3 colunas: primeira e última ficam encostadas na borda, nunca cortadas
  const primeira = posicaoBalao(0, 3, 350);
  const ultima = posicaoBalao(2, 3, 350);
  assert.equal(primeira.left, 0);
  assert.equal(ultima.left + ultima.width, 350);
  // Área estreita: o balão não fica mais largo que o gráfico
  const estreito = posicaoBalao(5, 6, 150);
  assert.ok(estreito.width <= 150 && estreito.left >= 0 && estreito.left + estreito.width <= 150);
});

function GraficoControlado({ Grafico, barras, desatualizado = false, unidade = 'L', metrica = 'Consumo no período' }) {
  const [selecionado, setSelecionado] = React.useState(null);
  return React.createElement(Grafico, {
    barras, maior: Math.max(...barras.map(b => b.valor ?? 0), 1), cor: '#38bdf8', casas: 1, unidade, metrica,
    chaveAnimacao: 'x', selecionado, onSelecionar: setSelecionado, desatualizado,
  });
}
const balaoAberto = view => textos(view).some(t => t === 'Consumo no período' || t === 'Potência média');
const colunas = view => view.root.findAllByType('TouchableOpacity').filter(n => n.props.accessibilityHint);
function abrirLayout(view) {
  // Simula a medida da área do gráfico (onLayout) para o balão poder ser posicionado
  const area = view.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function')[0];
  act(() => area.props.onLayout({ nativeEvent: { layout: { width: 350, height: 202 } } }));
}

test('balão: toque abre com período, métrica, valor e unidade; outra barra troca; mesmo toque e X fecham', () => {
  const Grafico = harness().load('components/hw/GraficoBarras.tsx').default;
  const barras = [{ label: 'Anteontem', valor: 142.5 }, { label: 'Ontem', valor: 0 }, { label: 'Hoje', valor: 88.4 }];
  let view;
  act(() => { view = Renderer.create(React.createElement(GraficoControlado, { Grafico, barras })); });
  try {
    abrirLayout(view);
    assert.equal(balaoAberto(view), false);
    act(() => colunas(view)[2].props.onPress());
    assert.ok(balaoAberto(view));
    assert.equal(colunas(view)[2].props.accessibilityState.selected, true, 'barra selecionada destacada e anunciada');
    let t = textos(view);
    assert.ok(t.includes('Hoje') && t.includes('Consumo no período') && t.includes('88.4') && t.includes(' L'));
    act(() => colunas(view)[1].props.onPress());
    t = textos(view);
    assert.ok(t.includes('Zero medido'), 'zero medido identificado no balão');
    assert.equal(colunas(view)[2].props.accessibilityState.selected, false);
    act(() => colunas(view)[1].props.onPress());
    assert.equal(balaoAberto(view), false, 'tocar de novo na mesma barra fecha');
    act(() => colunas(view)[0].props.onPress());
    const fechar = view.root.findAllByType('TouchableOpacity').find(n => n.props.accessibilityLabel === 'Fechar detalhes');
    act(() => fechar.props.onPress());
    assert.equal(balaoAberto(view), false, 'botão X fecha');
  } finally { act(() => view.unmount()); }
});

test('balão: período sem leitura, valor pequeno e dado desatualizado', () => {
  const Grafico = harness().load('components/hw/GraficoBarras.tsx').default;
  const barras = [{ label: 'Há 2 semanas', valor: null }, { label: 'Semana passada', valor: 0.034 }, { label: 'Esta semana', valor: 2 }];
  let view;
  act(() => { view = Renderer.create(React.createElement(GraficoControlado, { Grafico, barras, desatualizado: true, unidade: 'W', metrica: 'Potência média' })); });
  try {
    abrirLayout(view);
    act(() => colunas(view)[0].props.onPress());
    assert.ok(textos(view).includes('Sem leituras neste período'));
    assert.equal(textos(view).includes('Zero medido'), false, 'ausência de leitura não é zero');
    act(() => colunas(view)[1].props.onPress());
    assert.ok(textos(view).includes('0.034'), 'valor pequeno com precisão');
    assert.ok(textos(view).includes('<0.1'), 'rótulo da barra não mostra 0.0');
    const selo = view.root.findAllByType('SeloDesatualizado');
    assert.ok(selo.some(s => s.props.visivel === true), 'balão indica Desatualizado');
  } finally { act(() => view.unmount()); }
});

test('balão: Escape fecha na web e o listener é removido', () => {
  const ouvintes = new Set();
  globalThis.document = { addEventListener: (_, f) => ouvintes.add(f), removeEventListener: (_, f) => ouvintes.delete(f) };
  try {
    const Grafico = harness().load('components/hw/GraficoBarras.tsx').default;
    const barras = [{ label: 'Hoje', valor: 3 }, { label: 'Ontem', valor: 1 }, { label: 'Anteontem', valor: null }];
    let view;
    act(() => { view = Renderer.create(React.createElement(GraficoControlado, { Grafico, barras })); });
    abrirLayout(view);
    assert.equal(ouvintes.size, 0, 'sem seleção não há listener');
    act(() => colunas(view)[0].props.onPress());
    assert.equal(ouvintes.size, 1);
    act(() => [...ouvintes][0]({ key: 'Tab' }));
    assert.ok(balaoAberto(view), 'outras teclas não fecham');
    act(() => [...ouvintes][0]({ key: 'Escape' }));
    assert.equal(balaoAberto(view), false);
    assert.equal(ouvintes.size, 0, 'listener removido ao fechar');
    act(() => view.unmount());
  } finally { delete globalThis.document; }
});

function telaComDados(tela, { plus = true } = {}) {
  const agora = new Date();
  const leitura = { criado_em: new Date(agora.getTime() - 60e3), consumo_agua_litros: 88.4, vazao_l_min: 0.034, potencia_w: 40.2, tensao_v: 127, energia_kwh: 1 };
  const fonte = { estado: 'pronto', dados: [], erro: null, recebido: true, desatualizado: false, recebidoEmMs: agora.getTime() };
  const fakeHook = {
    disponibilidade: () => 'ok', exibivel: d => d === 'ok' || d === 'desatualizado',
    useLeiturasCentral: () => ({ leitura, historico: [leitura], historicoDiario: [], ultima: fonte, bruto: fonte, diario: fonte, fontes: [], tentarNovamente() {} }),
  };
  const h = harness({
    perfil: { plano: plus ? 'plus' : 'basico' },
    extras: {
      '@/hooks/use-leituras-central': fakeHook,
      '@/services/leiturasService': { centralEstaOnline: () => true },
      '@/services/baselineService': { calcularStatusBaseline: () => ({ fase: 'aprendizado', mediaAguaLitrosDia: 0, mediaEnergiaKwhDia: 0, diasRegistrados: 0, metaDias: 30, progressoPorcentagem: 0 }) },
    },
  });
  return render(h.load(`app/${tela}.tsx`).default);
}

for (const [tela, metrica, valorHoje, unidade] of [['agua', 'Consumo no período', '88.4', ' L'], ['energia', 'Potência média', '40.2', ' W']]) {
  test(`${tela}: seleção abre o balão da métrica certa, fecha ao tocar fora e limpa ao trocar de período`, () => {
    const view = telaComDados(tela);
    try {
      abrirLayout(view);
      const hoje = () => colunas(view).find(n => n.props.accessibilityLabel.startsWith('Hoje'));
      act(() => hoje().props.onPress());
      const t = textos(view);
      assert.ok(t.includes(metrica) && t.includes(valorHoje) && t.includes(unidade), `${tela}: ${metrica} ${valorHoje}${unidade}`);
      // Toque que começa dentro do cartão do gráfico: o evento sobe do cartão para o conteúdo e não fecha
      const [area, cartao] = view.root.findAll(n => n.type === 'View' && typeof n.props.onTouchStart === 'function');
      act(() => { cartao.props.onTouchStart(); area.props.onTouchStart(); });
      assert.ok(textos(view).includes(metrica), 'toque dentro do cartão não fecha');
      // Toque que começa fora (direto no conteúdo): fecha; o mouse (web) usa onMouseDown
      act(() => area.props.onMouseDown());
      assert.equal(textos(view).includes(metrica), false, 'tocar/clicar fora fecha');
      // Trocar de período com o balão aberto: o toque chega ao seletor e a seleção é limpa
      act(() => hoje().props.onPress());
      const semana = view.root.findAllByType('TouchableOpacity').find(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === 'Semana');
      act(() => semana.props.onPress());
      assert.equal(textos(view).includes(metrica), false, 'balão fechado após trocar o período');
      assert.equal(colunas(view)[2].props.accessibilityLabel.startsWith('Esta semana'), true, 'período trocou no mesmo toque');
    } finally { act(() => view.unmount()); }
  });
}

test('agua: plano Básico continua bloqueando Mês/Ano', () => {
  const view = telaComDados('agua', { plus: false });
  try {
    abrirLayout(view);
    act(() => colunas(view).find(n => n.props.accessibilityLabel.startsWith('Hoje')).props.onPress());
    const mes = view.root.findAllByType('TouchableOpacity').find(n => n.props.accessibilityRole === 'tab' && String(n.props.accessibilityLabel).startsWith('Mês'));
    act(() => mes.props.onPress());
    assert.ok(textos(view).includes('Conhecer plano Plus'), 'regra de plano preservada');
    assert.equal(colunas(view).length, 3, 'continua no período Dia');
  } finally { act(() => view.unmount()); }
});
