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
