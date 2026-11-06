'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { consolidate, summarizePeriod, createLocalConsolidator } = require('./consolidate.cjs');
const fixture = require('../fixtures/acceptance.json');
const periods = require('../fixtures/periods.json');
const expand = (changes = {}) => ({ ...structuredClone(fixture.base_event), ...structuredClone(changes) });
const options = fixture.options;
const sample = (seq, pulses, extra = {}) => expand({ seq, uptime_ms: 1000 + seq * 10000,
  measured_at: new Date(Date.parse(fixture.base_event.measured_at) + seq * 10000).toISOString(),
  water_pulses_total: pulses, ...extra });
const issue = (result, code) => result.diagnostics.some((d) => d.code === code);
const periodValues = (result) => Object.fromEntries(['water_l', 'energy_wh',
  'distribution_pending_water_l', 'distribution_pending_energy_wh',
  'boundary_pending_water_l', 'boundary_pending_energy_wh', 'coverage'].map((k) => [k, result[k]]));

for (const scenario of fixture.aggregation_cases) {
  test(`fixture aprovada: ${scenario.id}`, () => {
    const events = scenario.events.map(expand);
    const config = scenario.id === 'esp_reboot_water_epoch_changes_meter_continues'
      ? { ...options, continuity: [{ metric: 'energy_wh', from: 'boot-a__0', to: 'boot-b__0' }] } : options;
    const result = consolidate(events, config);
    assert.equal(result.totals.water_l ?? 0, scenario.expected.water_l);
    assert.equal(result.totals.energy_wh ?? 0, scenario.expected.energy_wh);
    assert.equal(result.unallocated.water_l ?? 0, scenario.expected.unallocated_water_l);
    assert.equal(result.unallocated.energy_wh ?? 0, scenario.expected.unallocated_energy_wh);
    const days = Object.fromEntries(Object.entries(result.daily).map(([day, values]) =>
      [day, { water_l: values.water_l, energy_wh: values.energy_wh }]));
    assert.deepEqual(days, scenario.expected.daily);
    assert.deepEqual(consolidate([...events].reverse().concat(events), config), result, 'replay/reordenação do lote inteiro');
  });
}

for (const scenario of periods.cases) {
  test(`período aprovado: ${scenario.id}`, () => {
    const result = consolidate([expand({ measured_at: scenario.from }),
      expand({ seq: 1, uptime_ms: 21000, measured_at: scenario.to,
        water_pulses_total: 102000, energy_total_wh: 1001 })], options);
    const expected = { ...scenario.expected };
    delete expected.issues; // Core exposes structured diagnostics, not the oracle's issue strings.
    assert.deepEqual(periodValues(summarizePeriod(result, scenario.period)), expected);
  });
}

test('snapshot idempotente e ingestão por lotes substituem contribuições, não incrementam totais', () => {
  const events = [sample(0, 100000), sample(1, 101000), sample(2, 103000)];
  const state = createLocalConsolidator(options);
  state.ingest([events[2], events[0]]);
  const final = state.ingest([events[1]]);
  assert.equal(final.totals.water_l, 3);
  assert.equal(final.contributions.filter((c) => c.metric === 'water_l').length, 2);
  assert.deepEqual(state.ingest(events.concat(events)), final);
  assert.deepEqual(state.snapshot(), final);
  assert.deepEqual(final, consolidate(events, options));
});

test('todas as permutações de quatro eventos geram o mesmo resultado completo', () => {
  const events = [sample(0, 100000), sample(1, 101000), sample(2, 102000), sample(3, 104000)];
  function permutations(items) {
    if (!items.length) return [[]];
    return items.flatMap((e, i) => permutations(items.filter((_, n) => n !== i)).map((tail) => [e, ...tail]));
  }
  const expected = consolidate(events, options);
  for (const permutation of permutations(events)) {
    assert.deepEqual(consolidate(permutation, options), expected);
    const state = createLocalConsolidator(options);
    for (const event of permutation) state.ingest([event, event]);
    assert.deepEqual(state.snapshot(), expected);
  }
});

test('amostra tardia recompõe os dois intervalos e a alocação diária/mensal', () => {
  const a = sample(0, 100000, { measured_at: '2026-11-07T02:59:50.000Z' });
  const b = sample(1, 101000, { measured_at: '2026-11-07T03:00:00.000Z' });
  const c = sample(2, 103000, { measured_at: '2026-11-07T03:00:10.000Z' });
  const state = createLocalConsolidator(options);
  const before = state.ingest([a, c]);
  assert.equal(before.unallocated.water_l, 3);
  const after = state.ingest([b]);
  assert.equal(after.unallocated.water_l, null);
  assert.equal(after.daily['2026-11-06'].water_l, 1);
  assert.equal(after.daily['2026-11-07'].water_l, 2);
  assert.equal(after.totals.water_l, 3);
  assert.notEqual(after.revision, before.revision);
  assert.deepEqual(state.ingest([b, a, c]), after);
});

test('D1: 1 L em cada dia e 2 L entre dias resultam em 4 L mensais, não 6', () => {
  const timestamps = ['2026-11-07T02:59:40.000Z', '2026-11-07T02:59:50.000Z',
    '2026-11-07T03:00:10.000Z', '2026-11-07T03:00:20.000Z'];
  const pulses = [100000, 101000, 103000, 104000];
  const result = consolidate(timestamps.map((measured_at, i) => sample(i, pulses[i], { measured_at })), options);
  const month = summarizePeriod(result, { start: '2026-11-01T03:00:00.000Z', end: '2026-12-01T03:00:00.000Z' });
  assert.equal(result.daily['2026-11-06'].water_l, 1);
  assert.equal(result.daily['2026-11-07'].water_l, 1);
  assert.equal(month.water_l, 4);
  assert.equal(month.distribution_pending_water_l, 2);
  assert.equal(new Set(month.included_contributions).size, month.included_contributions.length);
});

test('D2: boot diferente sem prova não cruza medidor; prova explícita preserva continuidade', () => {
  const events = [sample(0, 100000), sample(1, 101000, { energy_total_wh: 1002 }),
    sample(0, 0, { boot_id: 'boot-b', water_epoch: 'water-b', measured_at: '2026-11-06T15:00:20.000Z', energy_total_wh: 1005 }),
    sample(1, 1000, { boot_id: 'boot-b', water_epoch: 'water-b', measured_at: '2026-11-06T15:00:30.000Z', energy_total_wh: 1006 })];
  const noProof = consolidate(events, options);
  assert.equal(noProof.totals.energy_wh, 3); // 2 antes + 1 depois; 3 entre boots não comprovados.
  assert.ok(issue(noProof, 'continuity_unproven'));
  const withProof = consolidate(events, { ...options, continuity: [
    { metric: 'energy_wh', from: 'boot-a__1', to: 'boot-b__0' }] });
  assert.equal(withProof.totals.energy_wh, 6);
  assert.equal(withProof.totals.water_l, 2);
});

test('queda bloqueia restante da época afetada, mas nova época volta a medir', () => {
  const result = consolidate([sample(0, 100000), sample(1, 101000), sample(2, 90000),
    sample(3, 95000), sample(4, 0, { water_epoch: 'water-b' }), sample(5, 2000, { water_epoch: 'water-b' })], options);
  assert.equal(result.totals.water_l, 3); // 1 antes da queda + 2 em nova época.
  assert.ok(issue(result, 'counter_decreased'));
});

test('época reutilizada não ressuscita contador antigo', () => {
  const result = consolidate([sample(0, 100000), sample(1, 101000),
    sample(2, 0, { water_epoch: 'water-b' }), sample(3, 1000, { water_epoch: 'water-b' }),
    sample(4, 101000), sample(5, 110000)], options);
  assert.equal(result.totals.water_l, 2);
  assert.ok(issue(result, 'epoch_reused'));
});

test('sensor inválido recupera delta possível sem virar zero, instantâneo antigo fica null', () => {
  const invalid = sample(1, null);
  invalid.quality.water_pulses_total = 'invalid';
  invalid.power_w = null; invalid.quality.power_w = 'stale';
  const intermediate = consolidate([sample(0, 100000), invalid], options);
  assert.equal(intermediate.totals.water_l, null);
  assert.deepEqual(intermediate.latest.fields.power_w, { value: null, quality: 'stale' });
  const result = consolidate([sample(0, 100000), invalid, sample(2, 103000)], options);
  assert.equal(result.totals.water_l, 3);
  assert.ok(result.contributions.find((c) => c.metric === 'water_l').has_gap);
  assert.ok(issue(result, 'sensor_gap'));
});

test('dados estruturalmente inválidos, relógio incerto e legado ficam diagnosticados', () => {
  const result = consolidate([null, fixture.legacy_cases[0].input,
    sample(1, 102000, { clock_quality: 'unsynced', measured_at: null }),
    sample(2, 105000, { power_w: NaN })], options);
  assert.equal(result.latest, null);
  assert.equal(result.totals.water_l, null);
  assert.ok(issue(result, 'invalid_event'));
  assert.ok(issue(result, 'clock_uncertain'));
});

test('conflito de ID não depende do primeiro escritor nem desaparece com replay', () => {
  const a = sample(0, 100000);
  const b = sample(0, 900000);
  const state = createLocalConsolidator(options);
  state.ingest([a]);
  const result = state.ingest([b]);
  assert.equal(result.totals.water_l, null);
  assert.ok(issue(result, 'id_conflict'));
  assert.deepEqual(state.ingest([a, b]), result);
  assert.deepEqual(consolidate([b, a], options), result);
});

test('ordem do relógio contradiz sequência/uptime: boot fica fora dos cálculos', () => {
  const result = consolidate([sample(0, 100000), sample(1, 101000, { uptime_ms: 500 })], options);
  assert.equal(result.totals.water_l, null);
  assert.ok(issue(result, 'order_inconsistent'));
});

test('boots com horários sobrepostos são ambíguos mesmo com continuidade declarada', () => {
  const result = consolidate([sample(0, 100000), sample(2, 102000),
    sample(0, 1000, { boot_id: 'boot-b', water_epoch: 'water-b', measured_at: '2026-11-06T15:00:10.000Z' })], options);
  assert.equal(result.totals.water_l, null);
  assert.ok(issue(result, 'boot_overlap'));
});

test('perda de mensagens conserva delta sem inventar perfil temporal', () => {
  const result = consolidate([sample(0, 100000), sample(10, 104000)], options);
  assert.equal(result.totals.water_l, 4);
  assert.ok(issue(result, 'sequence_gap'));
  assert.ok(result.contributions.every((c) => c.has_gap));
  assert.equal(result.coverage, 'partial');
});

test('calibração desconhecida não inventa litros nem impede energia válida', () => {
  const result = consolidate([sample(0, 100000), sample(1, 101000, { energy_total_wh: 1001 })], { ...options, calibrations: {} });
  assert.equal(result.totals.water_l, null);
  assert.equal(result.totals.energy_wh, 1);
  assert.equal(result.daily['2026-11-06'].water_l, null);
  assert.ok(issue(result, 'unknown_calibration'));
});

test('trocar calibração cria fronteira e não reconverte o passado', () => {
  const result = consolidate([sample(0, 100000), sample(1, 101000),
    sample(2, 102000, { calibration_id: 'cal-b' }), sample(3, 104000, { calibration_id: 'cal-b' })],
  { ...options, calibrations: { 'cal-a': 1000, 'cal-b': 2000 } });
  assert.equal(result.totals.water_l, 2);
  assert.ok(issue(result, 'calibration_boundary'));
});

test('virada exata à meia-noite fecha o dia anterior sem pendência artificial', () => {
  const result = consolidate([sample(0, 100000, { measured_at: '2026-11-07T02:59:50.000Z' }),
    sample(1, 102000, { measured_at: '2026-11-07T03:00:00.000Z' })], options);
  assert.equal(result.daily['2026-11-06'].water_l, 2);
  assert.equal(result.daily['2026-11-07'], undefined);
  assert.equal(result.unallocated.water_l, null);
});

test('totais são conservados e referências/zero/ausência não são confundidos', () => {
  assert.equal(consolidate([], options).totals.water_l, null);
  assert.equal(consolidate([sample(0, 0)], options).totals.water_l, null);
  assert.equal(consolidate([sample(0, 0), sample(1, 0)], options).totals.water_l, 0);
  const result = consolidate([sample(0, 100000), sample(1, 101000), sample(2, 105000)], options);
  const water = result.contributions.filter((c) => c.metric === 'water_l');
  assert.equal(result.totals.water_l, water.reduce((total, c) => total + c.value, 0));
  assert.equal(new Set(water.map((c) => c.id)).size, water.length);
});

test('opções e resultados externos não alteram estado; entradas congeladas são aceitas', () => {
  const config = structuredClone(options);
  const state = createLocalConsolidator(config);
  config.calibrations['cal-a'] = 1;
  const events = [sample(0, 100000), sample(1, 101000)];
  for (const e of events) { Object.freeze(e.quality); Object.freeze(e); }
  const result = state.ingest(Object.freeze(events));
  result.totals.water_l = 999;
  assert.equal(state.snapshot().totals.water_l, 1);
});

test('parâmetros inválidos falham sem adivinhar fuso, calibração ou período', () => {
  assert.throws(() => consolidate([], { ...options, timezone: undefined }));
  assert.throws(() => consolidate([], { ...options, timezone: 'Invalid/Zone' }));
  assert.throws(() => consolidate([], { ...options, calibrations: { 'cal-a': 0 } }));
  assert.throws(() => consolidate({}, options));
  assert.throws(() => summarizePeriod(consolidate([], options), { start: '2026-11-06', end: '2026-12-01' }));
});

test('falha numérica não confirma lote parcialmente no acumulador', () => {
  const state = createLocalConsolidator({ ...options, calibrations: { 'cal-a': 1 } });
  const initial = state.ingest([sample(0, 0), sample(1, Number.MAX_SAFE_INTEGER)]);
  assert.throws(() => state.ingest([sample(2, 0, { water_epoch: 'water-b' }),
    sample(3, Number.MAX_SAFE_INTEGER, { water_epoch: 'water-b' })]), /numeric envelope/);
  assert.deepEqual(state.snapshot(), initial);
});

test('delta não finito por calibração extrema é diagnosticado sem publicar Infinity', () => {
  const result = consolidate([sample(0, 0), sample(1, 1000)],
    { ...options, calibrations: { 'cal-a': Number.MIN_VALUE } });
  assert.equal(result.totals.water_l, null);
  assert.ok(issue(result, 'numeric_overflow'));
});

test('consumo fracionário pequeno não é arredondado para zero', () => {
  const result = consolidate([sample(0, 100000), sample(1, 100001, { energy_total_wh: 1000.001 })], options);
  assert.equal(result.totals.water_l, 0.001);
  assert.ok(Math.abs(result.totals.energy_wh - 0.001) < 1e-9);
  assert.ok(result.totals.energy_wh > 0);
});

test('mudança de hora no fim do horário de verão não muda o dia da residência', () => {
  const result = consolidate([sample(0, 100000, { measured_at: '2026-11-01T05:30:00.000Z' }),
    sample(1, 102000, { measured_at: '2026-11-01T06:30:00.000Z', uptime_ms: 3601000 })],
  { ...options, timezone: 'America/New_York' });
  assert.equal(result.daily['2026-11-01'].water_l, 2);
  assert.equal(result.unallocated.water_l, null);
});

test('teto do contador não implica reset silencioso: precisa de nova época', () => {
  const events = [sample(0, Number.MAX_SAFE_INTEGER - 1), sample(1, Number.MAX_SAFE_INTEGER),
    sample(2, 0), sample(3, 1)];
  const result = consolidate(events, { ...options, calibrations: { 'cal-a': 1 } });
  assert.equal(result.totals.water_l, 1);
  assert.ok(issue(result, 'counter_decreased'));
});

test('retentativa com chaves JSON reordenadas não cria nova revisão', () => {
  const events = [sample(0, 100000), sample(1, 101000)];
  const reversedKeys = Object.fromEntries(Object.entries(events[1]).reverse());
  reversedKeys.quality = Object.fromEntries(Object.entries(events[1].quality).reverse());
  const state = createLocalConsolidator(options);
  const result = state.ingest(events);
  assert.deepEqual(state.ingest([reversedKeys]), result);
});
