const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual service without initializing Firebase or permitting real writes.
function harness(immediateError) {
  const queries = [], listeners = [], warnings = [];
  const firestore = {
    collection: (_db, name) => ({ collection: name }),
    where: (...args) => ({ where: args }),
    query: (...parts) => { queries.push(parts); return parts; },
    onSnapshot: (query, next, error) => {
      const listener = { query, next, error, stops: 0 };
      listeners.push(listener);
      if (immediateError) error(immediateError);
      return () => { listener.stops++; };
    },
  };
  const dependencies = { 'firebase/firestore': firestore, './firebase': { db: {} } };
  const filename = path.join(__dirname, '../src/services/baselineService.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console: { warn: (...args) => warnings.push(args) },
    require: name => {
      assert.ok(Object.hasOwn(dependencies, name), `Blocked unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename });
  return { service: module.exports, queries, listeners, warnings };
}

function snapshot(...days) {
  return {
    forEach: callback => days.forEach(day => callback({
      id: `central-test_${day}`,
      data: () => ({
        dispositivo_id: 'central-test', data: day,
        consumo_agua_litros: 100, energia_kwh: 3,
        pico_potencia_w: 500, pico_vazao_l_min: 2,
        media_tensao_v: 220, leituras_computadas: 7,
        atualizado_em: { toDate: () => new Date('2026-11-05T12:00:00Z') },
      }),
    })),
  };
}

test('daily: normal data preserves conversion, sorting, client-side limit and central filter', () => {
  const h = harness();
  const values = [];
  h.service.observarHistoricoDiario(value => values.push(value), 'central-test', 2);
  h.listeners[0].next(snapshot('2026-11-05', '2026-11-03', '2026-11-04'));
  assert.equal(JSON.stringify(values[0].map(row => row.data)), JSON.stringify(['2026-11-04', '2026-11-05']));
  assert.equal(values[0][0].consumo_agua_litros, 100);
  assert.equal(values[0][0].energia_kwh, 3);
  assert.equal(values[0][0].pico_potencia_w, 500);
  assert.equal(values[0][0].leituras_computadas, 7);
  assert.equal(values[0][0].atualizado_em.toISOString(), '2026-11-05T12:00:00.000Z');
  assert.equal(JSON.stringify(h.queries), JSON.stringify([
    [{ collection: 'consumo_diario' }, { where: ['dispositivo_id', '==', 'central-test'] }],
  ]));
});

test('daily: legitimate empty snapshot invokes data callback without error', () => {
  const h = harness();
  const values = [], errors = [];
  h.service.observarHistoricoDiario(v => values.push(v), 'central-test', undefined, e => errors.push(e));
  h.listeners[0].next(snapshot());
  assert.equal(JSON.stringify(values), '[[]]');
  assert.equal(errors.length, 0);
  assert.equal(h.listeners[0].stops, 0);
});

for (const code of ['permission-denied', 'failed-precondition', 'unavailable']) {
  test(`daily: ${code} forwards original error, closes once and never retries or emits empty`, () => {
    const h = harness();
    const values = [], errors = [];
    const stop = h.service.observarHistoricoDiario(v => values.push(v), 'central-test', 366, e => errors.push(e));
    const error = Object.assign(new Error('simulated failure'), { code });
    h.listeners[0].error(error);
    assert.equal(errors.length, 1);
    assert.equal(errors[0], error);
    assert.equal(values.length, 0);
    assert.equal(h.listeners[0].stops, 1);
    h.listeners[0].next(snapshot('2026-11-05'));
    h.listeners[0].next(snapshot());
    h.listeners[0].error(error);
    stop();
    stop();
    assert.equal(errors.length, 1);
    assert.equal(values.length, 0);
    assert.equal(h.listeners[0].stops, 1);
    assert.equal(h.listeners.length, 1);
    assert.equal(h.queries.length, 1);
    assert.ok(h.queries.every(parts => parts.some(p => p.where?.join('|') === 'dispositivo_id|==|central-test')));
  });
}

test('daily: after successful data an error does not replace it with empty data', () => {
  const h = harness();
  const values = [], errors = [];
  h.service.observarHistoricoDiario(v => values.push(v), 'central-test', 366, e => errors.push(e));
  h.listeners[0].next(snapshot('2026-11-05'));
  h.listeners[0].error({ code: 'unavailable', message: 'failure' });
  assert.equal(values.length, 1);
  assert.equal(values[0].length, 1);
  assert.equal(errors.length, 1);
});

test('daily: omitted onError logs code/message and still closes without emitting data', () => {
  const h = harness();
  const values = [];
  h.service.observarHistoricoDiario(v => values.push(v), 'central-test');
  h.listeners[0].error({ code: 'permission-denied', message: 'denied' });
  assert.equal(JSON.stringify(h.warnings), JSON.stringify([
    ['[Baseline] Erro ao observar historico diario:', 'permission-denied', 'denied'],
  ]));
  assert.equal(values.length, 0);
  assert.equal(h.listeners[0].stops, 1);
});

test('daily: cancellation is idempotent and discards late data and errors', () => {
  const h = harness();
  const values = [], errors = [];
  const stop = h.service.observarHistoricoDiario(v => values.push(v), 'central-test', 366, e => errors.push(e));
  stop();
  stop();
  h.listeners[0].next(snapshot('2026-11-05'));
  h.listeners[0].next(snapshot());
  h.listeners[0].error({ code: 'permission-denied', message: 'late' });
  assert.equal(h.listeners[0].stops, 1);
  assert.equal(values.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(h.warnings.length, 0);
  assert.equal(h.queries.length, 1);
});

test('daily: empty central returns empty synchronously without query and cleanup is repeatable', () => {
  const h = harness();
  const values = [];
  const stop = h.service.observarHistoricoDiario(v => values.push(v), '   ');
  assert.equal(JSON.stringify(values), '[[]]');
  stop();
  stop();
  assert.equal(h.queries.length, 0);
  assert.equal(h.listeners.length, 0);
});

test('daily: error during registration also releases the returned resource exactly once', () => {
  const error = { code: 'unavailable', message: 'immediate' };
  const h = harness(error);
  const errors = [];
  const stop = h.service.observarHistoricoDiario(() => assert.fail('unexpected data'), 'central-test', 366, e => errors.push(e));
  assert.equal(errors[0], error);
  stop();
  assert.equal(h.listeners[0].stops, 1);
});

test('calcularStatusBaseline: computes full-month forecast from measured days in month + remaining days * 30-day training average', () => {
  const h = harness();
  const diasOutubro = Array.from({ length: 30 }, (_, idx) => ({
    id: `central_${idx + 1}`,
    dispositivo_id: 'central',
    data: `2026-10-${String(idx + 1).padStart(2, '0')}`,
    consumo_agua_litros: 143.1,
    energia_kwh: 5.42,
    pico_potencia_w: 1800,
    pico_vazao_l_min: 7.5,
    media_tensao_v: 127,
    leituras_computadas: 24,
  }));
  const diasNovembro = [
    { id: 'c_1', dispositivo_id: 'central', data: '2026-11-01', consumo_agua_litros: 152.0, energia_kwh: 5.80, pico_potencia_w: 2400, pico_vazao_l_min: 9.2, media_tensao_v: 127, leituras_computadas: 4 },
    { id: 'c_2', dispositivo_id: 'central', data: '2026-11-02', consumo_agua_litros: 165.5, energia_kwh: 6.10, pico_potencia_w: 2550, pico_vazao_l_min: 10.4, media_tensao_v: 126.9, leituras_computadas: 4 },
    { id: 'c_3', dispositivo_id: 'central', data: '2026-11-03', consumo_agua_litros: 128.0, energia_kwh: 4.60, pico_potencia_w: 1750, pico_vazao_l_min: 7.5, media_tensao_v: 127.2, leituras_computadas: 4 },
    { id: 'c_4', dispositivo_id: 'central', data: '2026-11-04', consumo_agua_litros: 139.5, energia_kwh: 5.15, pico_potencia_w: 1920, pico_vazao_l_min: 8.1, media_tensao_v: 127, leituras_computadas: 4 },
    { id: 'c_5', dispositivo_id: 'central', data: '2026-11-05', consumo_agua_litros: 144.0, energia_kwh: 5.30, pico_potencia_w: 2050, pico_vazao_l_min: 8.6, media_tensao_v: 126.8, leituras_computadas: 4 },
    { id: 'c_6', dispositivo_id: 'central', data: '2026-11-06', consumo_agua_litros: 48.5, energia_kwh: 1.85, pico_potencia_w: 1480, pico_vazao_l_min: 6.8, media_tensao_v: 127.1, leituras_computadas: 3 },
  ];

  const status = h.service.calcularStatusBaseline(
    [...diasOutubro, ...diasNovembro],
    48.5,
    1.85,
    [],
    new Date(2026, 10, 6, 12, 0, 0)
  );

  assert.equal(status.fase, 'calibrado');
  assert.equal(status.mediaAguaLitrosDia, 143.1);
  assert.equal(status.mediaEnergiaKwhDia, 5.42);
  assert.equal(status.diasTotaisMesAtual, 30);
  assert.equal(status.diasComputadosMesAtual, 6);
  assert.equal(status.diasRestantesMesAtual, 24);
  assert.equal(status.aguaAcumuladaMesLitros, 777.5);
  assert.equal(status.energiaAcumuladaMesKwh, 28.8);
  assert.equal(status.previsaoAguaMesInteiroLitros, 4211.9);
  assert.equal(status.previsaoEnergiaMesInteiroKwh, 158.88);
});
