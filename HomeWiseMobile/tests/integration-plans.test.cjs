globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;

// Render the merged screens with fake Auth/services/native views. Never contact Firebase.
function harness(plan = 'basico') {
  let profile = { plano: plan, status_assinatura: 'ativa', ciclo_assinatura: 'mensal', nome: 'Teste' };
  let params = {};
  const routes = [];
  const source = { estado: 'erro', recebido: false, erro: { code: 'unavailable' }, recebidoEmMs: 0 };
  const sources = [{ rotulo: 'histórico diário', fonte: source }];
  const unavailable = {
    leitura: null, historico: [], historicoDiario: [], ultima: source, bruto: source, diario: source,
    fontes: sources, tentarNovamente() {},
  };
  const host = name => name;
  const native = Object.fromEntries([
    'ActivityIndicator', 'KeyboardAvoidingView', 'Modal', 'ScrollView', 'StatusBar',
    'Text', 'TextInput', 'TouchableOpacity', 'View',
  ].map(name => [name, host(name)]));
  native.StyleSheet = { create: styles => styles, absoluteFill: {} };
  native.Platform = { OS: 'web' };
  const cache = {};
  const deps = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ push: route => routes.push(route), replace() {} }), useLocalSearchParams: () => params },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Line: 'Line', Polyline: 'Polyline', Text: 'SvgText', Path: 'Path', Rect: 'Rect' },
    '@/contexts/AuthContext': { useAuth: () => ({ assinaturaEscritaLiberada: true, assinaturaEstado: 'pronta', user: { uid: 'fake-user' }, perfil: profile, dispositivoId: 'fake-central' }) },
    '@/components/AvisoFalhaLeituras': { __esModule: true, default: 'AvisoFalhaLeituras', SeloDesatualizado: 'SeloDesatualizado' },
    '@/components/SubscriptionUI': { SubscriptionScreen: 'SubscriptionScreen', PlanBenefits: 'PlanBenefits', PlanPrice: 'PlanPrice', subscriptionStyles: {} },
    '@/services/authService': { salvarPerfilFirestore: () => assert.fail('Unexpected write') },
    'firebase/firestore': {}, './firebase': { db: {} },
  };
  function load(relative) {
    if (cache[relative]) return cache[relative];
    const filename = path.join(__dirname, '../src', relative);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('module', 'exports', 'require', compiled)(module, module.exports, name => {
      if (Object.hasOwn(deps, name)) return deps[name];
      if (name.startsWith('@/')) {
        const target = name.slice(2);
        // Componentes .tsx fora de app/ (ex.: components/hw) também são resolvidos.
        const comTs = path.join(__dirname, '../src', target + '.ts');
        return load(target + (target.startsWith('app/') || !require('node:fs').existsSync(comTs) ? '.tsx' : '.ts'));
      }
      throw new Error(`Blocked unexpected dependency: ${name}`);
    });
    cache[relative] = module.exports;
    return module.exports;
  }
  deps['@/services/leiturasService'] = { centralEstaOnline: () => false };
  const hook = load('hooks/use-leituras-central.ts');
  deps['@/hooks/use-leituras-central'] = {
    ...hook, useLeiturasCentral: () => unavailable,
    useHistoricoCentral: () => ({ bruto: source, fontes: sources, tentarNovamente() {} }),
  };
  return { load, routes, sources, setProfile: value => { profile = value; }, setParams: value => { params = value; } };
}

function button(root, text) {
  return root.findAllByType('TouchableOpacity').find(node =>
    node.findAllByType('Text').some(label => label.props.children === text));
}

for (const screen of ['agua', 'energia']) {
  for (const plan of ['basico', 'plus']) {
    test(`integration: ${screen}/${plan} preserves source errors alongside plan controls`, () => {
      const h = harness(plan);
      const Screen = h.load(`app/${screen}.tsx`).default;
      let view;
      act(() => { view = Renderer.create(React.createElement(Screen)); });
      try {
        assert.equal(view.root.findByType('AvisoFalhaLeituras').props.fontes, h.sources);
        act(() => button(view.root, 'Mês').props.onPress());
        assert.equal(Boolean(button(view.root, 'Conhecer plano Plus')), plan === 'basico');
        assert.equal(view.root.findByType('AvisoFalhaLeituras').props.fontes[0].fonte.estado, 'erro');
      } finally { act(() => view.unmount()); }
    });
  }
}

for (const plan of ['basico', 'plus']) {
  test(`integration: metas/${plan} keeps error banner and the appropriate editor/upgrade action`, () => {
    const h = harness(plan);
    const Screen = h.load('app/metas.tsx').default;
    let view;
    act(() => { view = Renderer.create(React.createElement(Screen)); });
    try {
      act(() => view.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === 'Editar meta mensal').props.onPress());
      assert.equal(view.root.findByType('AvisoFalhaLeituras').props.fontes, h.sources);
      if (plan === 'basico') assert.deepEqual(h.routes, ['/gerenciar-assinatura']);
      else assert.equal(view.root.findByType('Modal').props.visible, true);
    } finally { act(() => view.unmount()); }
  });
}

test('integration: checkout deep link opens once and remains closed after dismissal', () => {
  const h = harness();
  h.setParams({ checkout: 'plus' });
  const Screen = h.load('app/gerenciar-assinatura.tsx').default;
  let view;
  act(() => { view = Renderer.create(React.createElement(Screen)); });
  try {
    assert.equal(view.root.findByType('Modal').props.visible, true);
    act(() => view.root.findByType('Modal').props.onRequestClose());
    assert.equal(view.root.findByType('Modal').props.visible, false);
    act(() => view.update(React.createElement(Screen)));
    assert.equal(view.root.findByType('Modal').props.visible, false);
    h.setParams({ checkout: 'premium' });
    act(() => view.update(React.createElement(Screen)));
    assert.equal(view.root.findByType('Modal').props.visible, true);
  } finally { act(() => view.unmount()); }
});

test('integration: subscription cycle tracks profile changes without overwriting manual selection', () => {
  const h = harness();
  const Screen = h.load('app/gerenciar-assinatura.tsx').default;
  let view;
  act(() => { view = Renderer.create(React.createElement(Screen)); });
  try {
    act(() => button(view.root, 'Anual').props.onPress());
    act(() => view.update(React.createElement(Screen)));
    assert.equal(button(view.root, 'Anual').props.accessibilityState.selected, true);
    h.setProfile({ ciclo_assinatura: 'anual' });
    act(() => view.update(React.createElement(Screen)));
    h.setProfile({ ciclo_assinatura: 'mensal' });
    act(() => view.update(React.createElement(Screen)));
    assert.equal(button(view.root, 'Mensal').props.accessibilityState.selected, true);
  } finally { act(() => view.unmount()); }
});
