// Testes de interface do hook src/hooks/use-leituras-central.ts.
//
// Executar (na pasta HomeWiseMobile):
//   node --test tests/useLeiturasCentral.test.cjs
//   npm test   (roda todos os tests/*.test.cjs, incluindo os dos services)
//
// O hook real é transpilado com o TypeScript do projeto e executado com o React do projeto
// (react-test-renderer@19.3.0, devDependency fixada na mesma versão do react).
// Os services são substituídos por fakes que seguem docs/leituras-contract.md e
// docs/historico-diario-contract.md; Firebase não é inicializado e imports inesperados são bloqueados.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');

// react-test-renderer avisa que está obsoleto; o aviso não afeta estes testes.
const consoleError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes('react-test-renderer is deprecated')) return;
  consoleError(...args);
};
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

const TIPOS = { ultima: 'ultima', bruto: 'bruto', diario: 'diario' };

function harness() {
  const listeners = [];
  function registrar(tipo, id, onDados, onErro, vazio) {
    if (!id || !id.trim()) { onDados(vazio); return () => {}; }
    const l = { tipo, id, onDados, onErro, ativo: true, encerrado: false };
    listeners.push(l);
    // Como no contrato: o retorno cancela e descarta eventos posteriores.
    return () => { l.ativo = false; };
  }
  const leiturasService = {
    observarUltimaLeitura: (cb, id = '', onError) => registrar(TIPOS.ultima, id, cb, onError, null),
    observarHistorico: (cb, limite = 30, id = '', onError) => {
      assert.equal(limite, null, 'telas usam histórico sem limite');
      return registrar(TIPOS.bruto, id, cb, onError, []);
    },
  };
  const baselineService = {
    observarHistoricoDiario: (cb, id, limiteDias = 366, onError) => {
      assert.equal(limiteDias, 366, 'preserva o limite padrão');
      return registrar(TIPOS.diario, id, cb, onError, []);
    },
  };
  const arquivo = path.join(__dirname, '../src/hooks/use-leituras-central.ts');
  const js = ts.transpileModule(readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dependencias = {
    react: React,
    '@/services/leiturasService': leiturasService,
    '@/services/baselineService': baselineService,
  };
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (nome) => {
    assert.ok(Object.hasOwn(dependencias, nome), `Dependência inesperada: ${nome}`);
    return dependencias[nome];
  });

  const ativos = (tipo) => listeners.filter((l) => l.ativo && (!tipo || l.tipo === tipo));
  const um = (tipo) => {
    const lista = ativos(tipo);
    assert.equal(lista.length, 1, `esperava 1 assinatura ativa de ${tipo}`);
    return lista[0];
  };
  // Erro terminal: o serviço encerra a assinatura antes de notificar.
  const falhar = (tipo, code) => act(() => {
    const l = um(tipo);
    l.ativo = false;
    l.onErro(Object.assign(new Error('mensagem técnica bruta'), { code }));
  });
  const enviar = (tipo, dados) => act(() => um(tipo).onDados(dados));
  return { hook: mod.exports, listeners, ativos, um, falhar, enviar };
}

function montar(nomeHook, uid, id) {
  const h = harness();
  const ref = { atual: null };
  function Componente(props) { ref.atual = h.hook[nomeHook](props.uid, props.id); return null; }
  let renderer;
  act(() => { renderer = TestRenderer.create(React.createElement(Componente, { uid, id })); });
  return {
    ...h,
    get r() { return ref.atual; },
    trocar: (novoUid, novoId) => act(() => renderer.update(React.createElement(Componente, { uid: novoUid, id: novoId }))),
    agir: (fn) => act(fn),
    desmontar: () => act(() => renderer.unmount()),
  };
}

const leitura = (litros) => ({ dispositivo_id: 'A', consumo_agua_litros: litros, vazao_l_min: 1, potencia_w: 100, energia_kwh: 1, tensao_v: 127, criado_em: new Date() });
const dia = (data) => ({ dispositivo_id: 'A', data, consumo_agua_litros: 10, energia_kwh: 1, pico_potencia_w: 0, pico_vazao_l_min: 0, media_tensao_v: 127, leituras_computadas: 1, atualizado_em: new Date() });

test('as três fontes começam carregando e ficam prontas separadamente', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  const { disponibilidade } = t.hook;
  assert.deepEqual([t.r.ultima.estado, t.r.bruto.estado, t.r.diario.estado], ['carregando', 'carregando', 'carregando']);
  t.enviar('ultima', leitura(5));
  t.enviar('bruto', [leitura(1)]);
  assert.equal(t.r.ultima.estado, 'pronto');
  assert.equal(t.r.bruto.estado, 'pronto');
  assert.equal(t.r.diario.estado, 'carregando');
  assert.equal(disponibilidade(t.r.bruto), 'ok', 'gráfico (só bruto) já disponível');
  assert.equal(disponibilidade(t.r.bruto, t.r.diario), 'carregando', 'totais aguardam o diário');
  t.enviar('diario', [dia('2026-11-01')]);
  assert.equal(disponibilidade(t.r.bruto, t.r.diario), 'ok');
  assert.equal(t.r.historicoDiario.length, 1);
  assert.ok(t.r.ultima.recebidoEmMs > 0);
});

test('resultado vazio é pronto, não erro', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.enviar('ultima', null);
  t.enviar('bruto', []);
  t.enviar('diario', []);
  assert.deepEqual([t.r.ultima.estado, t.r.bruto.estado, t.r.diario.estado], ['pronto', 'pronto', 'pronto']);
  assert.equal(t.r.leitura, null);
  assert.equal(t.hook.disponibilidade(t.r.bruto, t.r.diario), 'ok');
});

test('sem central: tudo pronto e vazio, sem consultas', () => {
  const t = montar('useLeiturasCentral', 'u1', '');
  assert.deepEqual([t.r.ultima.estado, t.r.bruto.estado, t.r.diario.estado], ['pronto', 'pronto', 'pronto']);
  assert.equal(t.listeners.length, 0);
});

test('falha apenas no histórico diário: não vira [], totais indisponíveis, gráfico e tempo real preservados', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  const { disponibilidade } = t.hook;
  t.enviar('ultima', leitura(5));
  t.enviar('bruto', [leitura(1)]);
  t.falhar('diario', 'permission-denied');
  assert.equal(t.r.diario.estado, 'erro');
  assert.equal(t.r.diario.recebido, false);
  assert.equal(t.r.diario.dados, undefined, 'erro não é tratado como lista vazia recebida');
  assert.equal(t.r.ultima.estado, 'pronto');
  assert.equal(t.r.bruto.estado, 'pronto');
  assert.equal(disponibilidade(t.r.bruto, t.r.diario), 'indisponivel', 'combinação não é apresentada como completa');
  assert.equal(disponibilidade(t.r.bruto), 'ok');
  assert.match(t.hook.mensagemErroLeituras(t.r.diario.erro), /permissão/);
  assert.deepEqual(t.r.fontes.filter((f) => f.fonte.estado === 'erro').map((f) => f.rotulo), ['histórico diário']);
});

test('sucesso de uma fonte não apaga o erro de outra', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.falhar('bruto', 'unavailable');
  t.enviar('ultima', leitura(1));
  t.enviar('diario', [dia('2026-11-01')]);
  t.enviar('ultima', leitura(2));
  assert.equal(t.r.bruto.estado, 'erro');
  assert.equal(t.r.bruto.erro.code, 'unavailable');
  assert.equal(t.r.ultima.estado, 'pronto');
});

test('erro após dados: valores mantidos e marcados como desatualizados', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.enviar('bruto', [leitura(1)]);
  t.enviar('diario', [dia('2026-11-01')]);
  t.falhar('diario', 'unavailable');
  assert.equal(t.r.diario.desatualizado, true);
  assert.equal(t.r.historicoDiario.length, 1);
  assert.equal(t.hook.disponibilidade(t.r.bruto, t.r.diario), 'desatualizado');
  assert.equal(t.hook.exibivel('desatualizado'), true);
});

test('recuperação manual recria só as assinaturas com erro, limpa o erro e mantém os dados', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.enviar('ultima', leitura(1));
  t.enviar('bruto', [leitura(1)]);
  t.enviar('diario', [dia('2026-11-01')]);
  t.falhar('diario', 'unavailable');
  const ultimaAntes = t.um('ultima');
  const brutoAntes = t.um('bruto');
  const total = t.listeners.length;
  t.agir(() => t.r.tentarNovamente());
  assert.equal(t.listeners.length, total + 1, 'apenas o diário foi recriado');
  assert.equal(t.um('ultima'), ultimaAntes);
  assert.equal(t.um('bruto'), brutoAntes);
  assert.equal(t.um('diario').id, 'A', 'mantém o filtro da central');
  assert.equal(t.r.diario.erro, null);
  assert.equal(t.r.diario.estado, 'pronto', 'dados anteriores continuam visíveis');
  t.enviar('diario', [dia('2026-11-01'), dia('2026-11-02')]);
  assert.equal(t.r.historicoDiario.length, 2);
  assert.equal(t.hook.disponibilidade(t.r.bruto, t.r.diario), 'ok');
});

test('nova falha após a tentativa volta a ser exibida', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.falhar('diario', 'unavailable');
  t.agir(() => t.r.tentarNovamente());
  assert.equal(t.r.diario.estado, 'carregando');
  t.falhar('diario', 'permission-denied');
  assert.equal(t.r.diario.erro.code, 'permission-denied');
});

test('sem repetição automática após erro', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.falhar('ultima', 'unavailable');
  t.falhar('bruto', 'unavailable');
  t.falhar('diario', 'unavailable');
  assert.equal(t.listeners.length, 3);
  assert.equal(t.ativos().length, 0);
});

test('troca de central limpa dados e erros, inclusive A → B → A', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.enviar('ultima', leitura(3));
  t.enviar('bruto', [leitura(3)]);
  t.falhar('diario', 'unavailable');
  t.trocar('u1', 'B');
  assert.deepEqual(t.ativos().map((l) => l.id), ['B', 'B', 'B']);
  assert.equal(t.r.leitura, null);
  assert.equal(t.r.diario.erro, null);
  assert.deepEqual([t.r.ultima.estado, t.r.bruto.estado, t.r.diario.estado], ['carregando', 'carregando', 'carregando']);
  t.trocar('u1', 'A');
  assert.equal(t.r.leitura, null, 'não reaproveita dado antigo de A');
  assert.equal(t.r.diario.erro, null, 'não reaproveita erro antigo de A');
  assert.equal(t.r.diario.estado, 'carregando');
  assert.deepEqual(t.ativos().map((l) => l.id), ['A', 'A', 'A']);
});

test('troca de usuário com a mesma central limpa dados e erros', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  t.enviar('ultima', leitura(3));
  t.falhar('diario', 'unavailable');
  t.trocar('u2', 'A');
  assert.equal(t.r.leitura, null);
  assert.equal(t.r.ultima.estado, 'carregando');
  assert.equal(t.r.diario.estado, 'carregando');
});

test('callbacks atrasados de sessões anteriores são ignorados', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  const velhos = t.ativos();
  t.trocar('u1', 'B');
  t.agir(() => {
    velhos.find((l) => l.tipo === 'ultima').onDados(leitura(99));
    velhos.find((l) => l.tipo === 'diario').onErro(Object.assign(new Error('x'), { code: 'unavailable' }));
  });
  assert.equal(t.r.leitura, null);
  assert.equal(t.r.diario.erro, null);
});

test('desmontagem cancela as três assinaturas', () => {
  const t = montar('useLeiturasCentral', 'u1', 'A');
  assert.equal(t.ativos().length, 3);
  t.desmontar();
  assert.equal(t.ativos().length, 0);
});

test('disponibilidade prioriza indisponível > carregando > desatualizado > ok', () => {
  const { disponibilidade } = harness().hook;
  const f = (estado, recebido) => ({ estado, recebido, desatualizado: estado === 'erro' && recebido });
  assert.equal(disponibilidade(f('pronto', true), f('pronto', true)), 'ok');
  assert.equal(disponibilidade(f('erro', true), f('pronto', true)), 'desatualizado');
  assert.equal(disponibilidade(f('erro', true), f('carregando', false)), 'carregando');
  assert.equal(disponibilidade(f('erro', false), f('carregando', false)), 'indisponivel');
});

test('mensagens não expõem texto técnico e distinguem permissão de conexão', () => {
  const { mensagemErroLeituras } = harness().hook;
  const e = (code) => Object.assign(new Error('mensagem técnica bruta'), { code });
  assert.match(mensagemErroLeituras(e('permission-denied')), /permissão/);
  assert.doesNotMatch(mensagemErroLeituras(e('permission-denied')), /internet|conex/i);
  assert.match(mensagemErroLeituras(e('unavailable')), /internet/);
  for (const code of ['failed-precondition', 'internal', 'unknown']) {
    const texto = mensagemErroLeituras(e(code));
    assert.doesNotMatch(texto, /técnica|índice/);
  }
});

test('Metas (useHistoricoCentral): erro antigo não reaparece ao voltar à central anterior', () => {
  const t = montar('useHistoricoCentral', 'u1', 'A');
  t.falhar('bruto', 'permission-denied');
  assert.equal(t.r.bruto.estado, 'erro');
  t.trocar('u1', 'B');
  t.enviar('bruto', [leitura(1)]);
  t.trocar('u1', 'A');
  assert.equal(t.r.bruto.estado, 'carregando', 'mostra carregamento, não o erro antigo');
  assert.equal(t.r.bruto.erro, null);
  t.enviar('bruto', []);
  assert.equal(t.r.bruto.estado, 'pronto');
});

test('Metas (useHistoricoCentral): recuperação manual e troca de usuário', () => {
  const t = montar('useHistoricoCentral', 'u1', 'A');
  t.enviar('bruto', [leitura(1)]);
  t.falhar('bruto', 'unavailable');
  assert.equal(t.r.bruto.desatualizado, true);
  t.agir(() => t.r.tentarNovamente());
  assert.equal(t.r.bruto.erro, null);
  assert.equal(t.ativos('bruto').length, 1);
  t.trocar('u2', 'A');
  assert.equal(t.r.bruto.dados, undefined);
  assert.equal(t.r.bruto.estado, 'carregando');
});
