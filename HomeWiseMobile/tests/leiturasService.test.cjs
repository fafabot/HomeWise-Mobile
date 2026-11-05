const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual service with isolated dependencies: never initialize Firebase.
function harness() {
  const listeners = [];
  const queries = [];
  const syncs = [];
  const firestore = {
    collection: (_db, name) => ({ collection: name }),
    where: (...args) => ({ where: args }),
    orderBy: (...args) => ({ orderBy: args }),
    limit: value => ({ limit: value }),
    query: (...parts) => { queries.push(parts); return parts; },
    onSnapshot: (query, next, error) => {
      const listener = { query, next, error, stops: 0 };
      listeners.push(listener);
      return () => { listener.stops++; };
    },
  };
  const dependencies = {
    'firebase/firestore': firestore,
    './firebase': { db: {} },
    './baselineService': { sincronizarConsumoDiario: async value => { syncs.push(value); } },
  };
  const filename = path.join(__dirname, '../src/services/leiturasService.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console: { warn() {} },
    require: name => {
      assert.ok(Object.hasOwn(dependencies, name), `Blocked unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename });
  return { service: module.exports, listeners, queries, syncs };
}

const empty = { empty: true, docs: [] };
const snapshot = {
  empty: false,
  docs: [{ id: 'reading', data: () => ({ dispositivo_id: 'central-test', energia_kwh: 3 }) }],
};
const variants = [
  { name: 'ultima', start: (s, next, error, id = 'central-test') => s.observarUltimaLeitura(next, id, error), empty: null },
  { name: 'historico', start: (s, next, error, id = 'central-test') => s.observarHistorico(next, 30, id, error), empty: [] },
  { name: 'historico sem limite', start: (s, next, error, id = 'central-test') => s.observarHistorico(next, null, id, error), empty: [] },
];

for (const variant of variants) {
  for (const code of ['permission-denied', 'failed-precondition', 'unavailable']) {
    test(`${variant.name}: ${code} reports the original error without new queries or empty data`, () => {
      const h = harness();
      const values = [], errors = [];
      const stop = variant.start(h.service, value => values.push(value), error => errors.push(error));
      const error = Object.assign(new Error('simulated query failure'), { code });
      h.listeners[0].error(error);
      assert.equal(h.queries.length, 1);
      assert.equal(h.listeners.length, 1);
      assert.ok(h.queries.every(parts => parts.some(p => p.where?.join('|') === 'dispositivo_id|==|central-test')));
      assert.equal(errors.length, 1);
      assert.equal(errors[0], error);
      assert.equal(values.length, 0);
      // Firestore errors terminate subscriptions; queued events must stay discarded.
      h.listeners[0].next(snapshot);
      h.listeners[0].error(error);
      assert.equal(errors.length, 1);
      assert.equal(values.length, 0);
      stop();
      assert.equal(h.listeners[0].stops, 1);
    });
  }

  test(`${variant.name}: empty snapshot is delivered as empty, not an error`, () => {
    const h = harness();
    const values = [], errors = [];
    variant.start(h.service, value => values.push(value), error => errors.push(error));
    h.listeners[0].next(empty);
    assert.equal(JSON.stringify(values), JSON.stringify([variant.empty]));
    assert.equal(errors.length, 0);
    assert.equal(h.syncs.length, 0);
  });

  test(`${variant.name}: cancellation unsubscribes and blocks later data, errors and side effects`, () => {
    const h = harness();
    const values = [], errors = [];
    const stop = variant.start(h.service, value => values.push(value), error => errors.push(error));
    stop();
    h.listeners[0].next(snapshot);
    h.listeners[0].next(empty);
    h.listeners[0].error(Object.assign(new Error('late'), { code: 'permission-denied' }));
    assert.equal(h.listeners[0].stops, 1);
    assert.equal(values.length, 0);
    assert.equal(errors.length, 0);
    assert.equal(h.syncs.length, 0);
    assert.equal(h.queries.length, 1);
  });

  test(`${variant.name}: no central returns empty without opening a query`, () => {
    const h = harness();
    const values = [];
    const stop = variant.start(h.service, value => values.push(value), undefined, '   ');
    assert.equal(JSON.stringify(values), JSON.stringify([variant.empty]));
    assert.equal(h.queries.length, 0);
    stop();
  });

  test(`${variant.name}: existing consumers may omit the optional error callback`, () => {
    const h = harness();
    variant.start(h.service, () => {});
    assert.doesNotThrow(() => h.listeners[0].error({ code: 'permission-denied', message: 'denied' }));
    assert.equal(h.queries.length, 1);
  });
}
