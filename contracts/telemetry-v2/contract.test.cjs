'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/acceptance.json');
const { validate, canonical, summarize, summarizePeriod, selectBaseline, allowed, classify, localDate } = require('./reference.cjs');
const expand = (changes) => ({ ...structuredClone(fixture.base_event), ...structuredClone(changes) });
const periods = require('./fixtures/periods.json');
const baseline = require('./fixtures/baseline.json');
const baselineDays = Array.from({ length: baseline.days }, (_, i) => ({ schema_version: 2,
  local_date: `${baseline.month}-${String(i + 1).padStart(2, '0')}`, status: 'complete', valid: true,
  water_l: i === 0 ? baseline.first_day_water_l : baseline.other_days_water_l,
  energy_wh: i === 0 ? baseline.first_day_energy_wh : baseline.other_days_energy_wh }));

test('D6: 30 dias completos válidos incluem zero e excluem dia atual/legado/inválidos', () => {
  const result = selectBaseline([...baseline.exclusions, ...baselineDays], baseline.today);
  assert.equal(result.phase, baseline.expected.phase);
  assert.equal(result.count, baseline.expected.count);
  assert.equal(result.water_l_per_day, baseline.expected.water_total_l / 30);
  assert.equal(result.energy_wh_per_day, baseline.expected.energy_total_wh / 30);
  assert.equal(result.dates[0], '2026-11-01');
  assert.equal(result.dates.at(-1), '2026-11-30');
});

test('D6: 29 dias válidos ainda são aprendizado; repetir dia não completa 30', () => {
  const result = selectBaseline([...baselineDays.slice(0, 29), baselineDays[0]], baseline.today);
  assert.equal(result.phase, 'learning');
  assert.equal(result.count, 29);
  assert.equal(result.water_l_per_day, null);
});

test('D6: referência congelada só muda com recalibração explícita', () => {
  const stored = selectBaseline(baselineDays, baseline.today);
  const changed = baselineDays.map((d) => ({ ...d, water_l: 10 }));
  assert.deepEqual(selectBaseline(changed, baseline.today, stored), stored);
  assert.equal(selectBaseline(changed, baseline.today, stored, true).water_l_per_day, 10);
  assert.equal(stored.water_l_per_day, 29 / 30);
});

test('D6: resumos conflitantes do mesmo dia precisam de reconciliação explícita', () => {
  assert.throws(() => selectBaseline([...baselineDays, { ...baselineDays[0], water_l: 50 }], baseline.today));
});

for (const scenario of periods.cases) {
  test(`D1 por período: ${scenario.id}`, () => {
    const events = [expand({ measured_at: scenario.from }), expand({ seq: 1, uptime_ms: 21000,
      measured_at: scenario.to, water_pulses_total: 102000, energy_total_wh: 1001 })];
    assert.deepEqual(summarizePeriod(events, fixture.options, scenario.period), scenario.expected);
    assert.deepEqual(summarizePeriod([events[1], events[0], events[1]], fixture.options, scenario.period), scenario.expected);
  });
}

test('D1: intervalo terminando na fronteira pertence ao período anterior por inteiro', () => {
  const events = [expand({ measured_at: '2026-11-07T02:59:50.000Z' }), expand({ seq: 1, uptime_ms: 11000,
    measured_at: '2026-11-07T03:00:00.000Z', water_pulses_total: 102000 })];
  const previous = summarizePeriod(events, fixture.options, { start: '2026-11-06T03:00:00.000Z', end: '2026-11-07T03:00:00.000Z' });
  const next = summarizePeriod(events, fixture.options, { start: '2026-11-07T03:00:00.000Z', end: '2026-11-08T03:00:00.000Z' });
  assert.equal(previous.water_l, 2);
  assert.equal(next.water_l, null);
});

test('D1: limites inválidos são rejeitados em vez de adivinhar período', () => {
  assert.throws(() => summarizePeriod([], fixture.options, { start: '2026-12-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' }));
});

test('D1: mês inclui dias conhecidos e intervalo pendente sem dupla contagem', () => {
  const times = ['2026-11-07T02:59:40.000Z', '2026-11-07T02:59:50.000Z',
    '2026-11-07T03:00:10.000Z', '2026-11-07T03:00:20.000Z'];
  const pulses = [100000, 101000, 103000, 104000];
  const events = times.map((measured_at, seq) => expand({ measured_at, seq,
    uptime_ms: 1000 + seq * 20000, water_pulses_total: pulses[seq] }));
  const month = summarizePeriod(events, fixture.options,
    { start: '2026-11-01T03:00:00.000Z', end: '2026-12-01T03:00:00.000Z' });
  const daily = summarize(events, fixture.options).daily;
  assert.equal(daily['2026-11-06'].water_l, 1);
  assert.equal(daily['2026-11-07'].water_l, 1);
  assert.equal(month.water_l, 4);
  assert.equal(month.distribution_pending_water_l, 2); // Já integra os 4 L.
  assert.equal(month.boundary_pending_water_l, 0);
});

test('base completa válida, sem credenciais e sem hora de recepção da central', () => {
  assert.deepEqual(validate(fixture.base_event), []);
  assert.equal(classify(fixture.base_event), 'v2');
  for (const field of ['received_at', 'token', 'password', 'api_key']) assert.equal(Object.hasOwn(fixture.base_event, field), false);
});

for (const scenario of fixture.aggregation_cases) {
  test(`agregação: ${scenario.id}`, () => {
    const events = scenario.events.map(expand);
    for (const event of events) assert.deepEqual(validate(event), []);
    const original = structuredClone(events);
    assert.deepEqual(summarize(events, fixture.options), scenario.expected);
    assert.deepEqual(events, original, 'oráculo não modifica entradas');
  });
}

for (const scenario of fixture.invalid_cases) {
  test(`rejeição: ${scenario.id}`, () => {
    assert.ok(validate(expand(scenario.changes)).includes(scenario.error));
  });
}

for (const scenario of fixture.delivery_cases) {
  test(`recepção simulada: ${scenario.id}`, () => {
    // received_at é metadata do servidor, não é incorporado ao payload.
    // Estes dados sintéticos não comprovam atribuição confiável no Firestore.
    const events = scenario.deliveries.map((delivery) => expand(delivery.event_changes));
    assert.deepEqual(summarize(events, fixture.options), scenario.expected);
    assert.equal(Object.hasOwn(events[0], 'received_at'), false);
  });
}

for (const scenario of fixture.permission_cases) {
  test(`permissão proposta: ${scenario.id}`, () => {
    assert.equal(allowed(scenario.request), scenario.expected);
  });
}

for (const [index, scenario] of fixture.legacy_cases.entries()) {
  test(`compatibilidade ${index}: ${scenario.expected}`, () => {
    assert.equal(classify(scenario.input), scenario.expected);
  });
}

test('duplicação, ordem de entrega e ordem das chaves não alteram total', () => {
  const scenario = fixture.aggregation_cases.find((s) => s.id === '100_103_103_liters');
  const events = scenario.events.map(expand);
  const reorderedKeys = Object.fromEntries(Object.entries(events[1]).reverse());
  const arrival = [events[2], events[0], events[1], events[2], reorderedKeys];
  assert.deepEqual(summarize(arrival, fixture.options), scenario.expected);
  assert.deepEqual(canonical(events[1]), canonical(reorderedKeys));
});

test('reprocessar lote ou evento tardio não depende da chegada anterior', () => {
  const events = [{}, { seq: 1, uptime_ms: 11000, measured_at: '2026-11-06T15:00:10.000Z', water_pulses_total: 101000 },
    { seq: 2, uptime_ms: 21000, measured_at: '2026-11-06T15:00:20.000Z', water_pulses_total: 103000 }].map(expand);
  const before = summarize([events[0], events[2]], fixture.options);
  const after = summarize([events[2], events[0], events[1]], fixture.options);
  assert.equal(before.water_l, 3);
  assert.ok(before.issues.includes('sequence_gap'));
  assert.equal(after.water_l, 3);
  assert.deepEqual(after.issues, []);
  assert.deepEqual(after, summarize(events, fixture.options));
});

test('qualidade inválida/missing/stale exige null; zero continua válido', () => {
  for (const quality of ['invalid', 'missing', 'stale']) {
    const event = expand({ flow_l_min: null });
    event.quality.flow_l_min = quality;
    assert.deepEqual(validate(event), []);
    event.flow_l_min = 0;
    assert.ok(validate(event).includes('flow_l_min'));
  }
  assert.deepEqual(validate(expand({ flow_l_min: 0 })), []);
});

test('campos ausentes, qualidade incompleta e números não finitos são rejeitados', () => {
  const absent = expand({});
  delete absent.power_w;
  assert.ok(validate(absent).includes('fields'));
  assert.ok(validate(expand({ quality: {} })).includes('quality'));
  for (const value of [NaN, Infinity, -Infinity]) assert.ok(validate(expand({ power_w: value })).includes('power_w'));
});

test('calibração desconhecida não inventa litros e fuso inválido é erro', () => {
  const events = [{}, { seq: 1, uptime_ms: 11000, measured_at: '2026-11-06T15:00:10.000Z', water_pulses_total: 103000 }].map(expand);
  const result = summarize(events, { ...fixture.options, calibrations: {} });
  assert.equal(result.water_l, 0);
  assert.ok(result.issues.includes('unknown_calibration'));
  assert.throws(() => summarize(events, { ...fixture.options, timezone: 'Invalid/Zone' }), RangeError);
});

test('fuso da residência e horário de verão não dependem do celular', () => {
  assert.equal(localDate('2026-11-07T01:00:00.000Z', 'America/Sao_Paulo'), '2026-11-06');
  assert.equal(localDate('2026-11-07T01:00:00.000Z', 'UTC'), '2026-11-07');
  assert.equal(localDate('2026-11-01T05:30:00.000Z', 'America/New_York'), '2026-11-01');
  assert.equal(localDate('2026-11-01T06:30:00.000Z', 'America/New_York'), '2026-11-01');
});

test('v1 nunca é promovido a v2 ou somado pelo oráculo', () => {
  const legacy = fixture.legacy_cases[0].input;
  const result = summarize([legacy], fixture.options);
  assert.equal(result.water_l, 0);
  assert.equal(result.energy_wh, 0);
  assert.deepEqual(result.daily, {});
  assert.deepEqual(result.issues, ['invalid_event']);
});

test('conservação: deltas recuperados são alocados uma única vez ou ficam não alocados', () => {
  for (const scenario of fixture.aggregation_cases) {
    const result = summarize(scenario.events.map(expand), fixture.options);
    for (const [key, unallocated] of [['water_l', 'unallocated_water_l'], ['energy_wh', 'unallocated_energy_wh']]) {
      const allocated = Object.values(result.daily).reduce((sum, day) => sum + (day[key] ?? 0), 0);
      assert.equal(result[key], allocated + result[unallocated], scenario.id);
    }
  }
});

test('métrica sem contribuição não é publicada como zero válido', () => {
  const scenario = fixture.aggregation_cases.find((s) => s.id === 'calibration_change_is_boundary');
  const result = summarize(scenario.events.map(expand), fixture.options);
  assert.equal(result.daily['2026-11-06'].water_l, null);
  assert.equal(result.daily['2026-11-06'].energy_wh, 1);
});

test('consumo positivo pequeno mantém sua unidade e não vira zero', () => {
  const events = [{}, { seq: 1, uptime_ms: 11000, measured_at: '2026-11-06T15:00:10.000Z',
    water_pulses_total: 100001, energy_total_wh: 1000.001 }].map(expand);
  const result = summarize(events, fixture.options);
  assert.equal(result.water_l, 0.001); // Um pulso na calibração sintética de 1000 pulsos/L.
  assert.ok(Math.abs(result.energy_wh - 0.001) < 1e-9); // Tolerância aritmética, não física.
  assert.ok(result.energy_wh > 0);
});
