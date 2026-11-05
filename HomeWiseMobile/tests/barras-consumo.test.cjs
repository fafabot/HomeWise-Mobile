// Barras de consumo por período (gráfico de Água): usam calcularConsumoPorPeriodo sem alterar a fórmula.
// Rodar: node --test tests/barras-consumo.test.cjs  (ou npm test)
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const cache = {};
function load(rel) {
  if (cache[rel]) return cache[rel];
  const js = ts.transpileModule(readFileSync(path.join(__dirname, '../src', rel), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (nome) => {
    if (nome.startsWith('@/')) return load(nome.slice(2) + '.ts');
    throw new Error(`Dependência inesperada: ${nome}`);
  });
  return (cache[rel] = mod.exports);
}
const { montarBarrasConsumo } = load('utils/barras-consumo.ts');
const { calcularConsumoPorPeriodo } = load('utils/grafico-periodos.ts');

// O contador da central é acumulado no dia: vale o maior valor de cada dia.
const leitura = (iso, litros) => ({ criado_em: new Date(iso), consumo_agua_litros: litros, energia_kwh: 0, vazao_l_min: 0, potencia_w: 0, tensao_v: 127 });
const agora = new Date(2026, 10, 5, 15, 0); // 05/11/2026 15:00 (quinta)

test('Dia: cada barra soma o dia correspondente; hoje igual ao cartão', () => {
  const leituras = [
    leitura('2026-11-03T10:00:00', 50), leitura('2026-11-03T20:00:00', 120), // anteontem: 120
    leitura('2026-11-05T08:00:00', 30), leitura('2026-11-05T14:00:00', 75),  // hoje: 75
  ];
  const barras = montarBarrasConsumo(leituras, [], 'dia', 'consumo_agua_litros', agora);
  assert.deepEqual(barras.map(b => b.label), ['Anteontem', 'Ontem', 'Hoje']);
  assert.deepEqual(barras.map(b => b.valor), [120, null, 75], 'ontem sem leituras fica null, não zero');
  assert.equal(barras[2].valor, calcularConsumoPorPeriodo(leituras, 'dia', 'consumo_agua_litros', [], agora));
});

test('zero medido continua zero e não vira ausência de leitura', () => {
  const barras = montarBarrasConsumo([leitura('2026-11-04T09:00:00', 0)], [], 'dia', 'consumo_agua_litros', agora);
  assert.deepEqual(barras.map(b => b.valor), [null, 0, null]);
});

test('Mês e Ano: usam resumos diários e o mês atual bate com o cartão', () => {
  const diario = [
    { data: '2026-09-10', consumo_agua_litros: 300, energia_kwh: 0 },
    { data: '2026-10-01', consumo_agua_litros: 200, energia_kwh: 0 },
    { data: '2026-10-02', consumo_agua_litros: 250, energia_kwh: 0 },
    { data: '2025-03-15', consumo_agua_litros: 90, energia_kwh: 0 },
  ];
  const leituras = [leitura('2026-11-02T12:00:00', 40), leitura('2026-11-05T12:00:00', 60)];
  const mes = montarBarrasConsumo(leituras, diario, 'mes', 'consumo_agua_litros', agora);
  assert.deepEqual(mes.map(b => b.valor), [null, null, null, 300, 450, 100]);
  assert.equal(mes[5].valor, calcularConsumoPorPeriodo(leituras, 'mes', 'consumo_agua_litros', diario, agora));
  const ano = montarBarrasConsumo(leituras, diario, 'ano', 'consumo_agua_litros', agora);
  assert.deepEqual(ano.map(b => b.label), ['2022', '2023', '2024', '2025', '2026']);
  assert.deepEqual(ano.map(b => b.valor), [null, null, null, 90, 850]);
  assert.equal(ano[4].valor, calcularConsumoPorPeriodo(leituras, 'ano', 'consumo_agua_litros', diario, agora));
});

test('Semana: semanas começam na segunda e o dia do resumo e da leitura não é somado duas vezes', () => {
  const diario = [{ data: '2026-11-03', consumo_agua_litros: 80, energia_kwh: 0 }];
  const leituras = [leitura('2026-11-03T18:00:00', 95), leitura('2026-10-28T10:00:00', 20)];
  const semana = montarBarrasConsumo(leituras, diario, 'semana', 'consumo_agua_litros', agora);
  assert.deepEqual(semana.map(b => b.label), ['Há 2 semanas', 'Semana passada', 'Esta semana']);
  assert.deepEqual(semana.map(b => b.valor), [null, 20, 95], 'mesmo dia vale o maior entre resumo e leitura');
});

test('leituras futuras ou sem data não entram', () => {
  const barras = montarBarrasConsumo([leitura('2026-11-05T23:00:00', 999), { criado_em: null, consumo_agua_litros: 5 }], [], 'dia', 'consumo_agua_litros', agora);
  assert.deepEqual(barras.map(b => b.valor), [null, null, null]);
});
