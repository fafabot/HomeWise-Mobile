'use strict';

// Oráculo puro para revisão; não importar no aplicativo ou no firmware.
const idPattern = /^(?!.*__)[A-Za-z0-9_-]{1,64}$/;
const metrics = ['water_pulses_total', 'energy_total_wh', 'flow_l_min', 'power_w', 'voltage_v'];
const fields = ['schema_version', 'device_id', 'firmware_version', 'boot_id', 'seq',
  'uptime_ms', 'measured_at', 'clock_quality', 'water_epoch', 'water_pulses_total',
  'calibration_id', 'energy_epoch', 'energy_total_wh', 'flow_l_min', 'power_w',
  'voltage_v', 'quality'];
const isSafe = (n) => Number.isSafeInteger(n) && n >= 0;

function validTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}

function validate(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return ['object'];
  const errors = [];
  if (Object.keys(event).some((k) => !fields.includes(k)) || fields.some((k) => !(k in event))) errors.push('fields');
  if (event.schema_version !== 2) errors.push('schema_version');
  for (const k of ['device_id', 'boot_id', 'water_epoch', 'energy_epoch', 'calibration_id']) {
    if (typeof event[k] !== 'string' || !idPattern.test(event[k])) errors.push(k);
  }
  if (typeof event.firmware_version !== 'string' || event.firmware_version.length < 1 || event.firmware_version.length > 64) errors.push('firmware_version');
  for (const k of ['seq', 'uptime_ms']) if (!isSafe(event[k])) errors.push(k);
  if (!['synced', 'estimated', 'unsynced'].includes(event.clock_quality)) errors.push('clock_quality');
  if (event.clock_quality === 'unsynced' ? event.measured_at !== null : !validTime(event.measured_at)) errors.push('measured_at');
  const quality = event.quality;
  if (!quality || typeof quality !== 'object' || Array.isArray(quality) ||
      Object.keys(quality).length !== metrics.length || metrics.some((k) => !(k in quality))) {
    errors.push('quality');
  } else {
    for (const k of metrics) {
      if (!['valid', 'invalid', 'missing', 'stale'].includes(quality[k])) errors.push(`quality.${k}`);
      const n = event[k];
      if (quality[k] === 'valid') {
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER ||
            (k === 'water_pulses_total' && !isSafe(n))) errors.push(k);
      } else if (n !== null) errors.push(k);
    }
  }
  return errors;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

function localDate(iso, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function classify(event) {
  if (!event || typeof event !== 'object') return 'unsupported';
  if (event.schema_version === 2) return validate(event).length ? 'invalid_v2' : 'v2';
  if (Object.hasOwn(event, 'schema_version')) return 'unsupported';
  return ['dispositivo_id', 'consumo_agua_litros', 'energia_kwh', 'criado_em']
    .every((k) => Object.hasOwn(event, k)) ? 'legacy_v1' : 'unsupported';
}

function computeIntervals(events, { device_id, timezone, calibrations }) {
  // Lote pequeno, recalculado integralmente. Nenhum estado, I/O ou trigger.
  localDate('2026-01-01T00:00:00.000Z', timezone); // Rejeita fuso inválido.
  const issues = new Set();
  const byId = new Map();
  const conflicted = new Set();
  for (const event of events) {
    if (validate(event).length) { issues.add('invalid_event'); continue; }
    if (event.device_id !== device_id) { issues.add('wrong_device'); continue; }
    const id = `${event.boot_id}__${event.seq}`;
    if (byId.has(id) && JSON.stringify(canonical(byId.get(id))) !== JSON.stringify(canonical(event))) {
      conflicted.add(id); issues.add('id_conflict');
    } else byId.set(id, event);
  }
  const ordered = [...byId.entries()].filter(([id]) => !conflicted.has(id)).map(([, e]) => e)
    .filter((e) => {
      if (e.clock_quality !== 'synced') { issues.add('clock_uncertain'); return false; }
      return true;
    }).sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at) || a.seq - b.seq);

  const invalidBoots = new Set();
  const previousBoot = new Map();
  for (const e of ordered) {
    const p = previousBoot.get(e.boot_id);
    if (p && (e.seq <= p.seq || e.uptime_ms <= p.uptime_ms || e.measured_at <= p.measured_at)) {
      invalidBoots.add(e.boot_id); issues.add('order_inconsistent');
    }
    if (p && e.seq !== p.seq + 1) issues.add('sequence_gap');
    previousBoot.set(e.boot_id, e);
  }
  const usable = ordered.filter((e) => !invalidBoots.has(e.boot_id));
  const result = {
    water_l: 0, energy_wh: 0, daily: {}, unallocated_water_l: 0,
    unallocated_energy_wh: 0, coverage: 'partial', issues: [],
  };
  const intervals = [];
  // Partial sempre: estas fixtures não demonstram cobertura de um dia completo.
  for (const metric of ['water_pulses_total', 'energy_total_wh']) {
    const water = metric === 'water_pulses_total';
    let previous = null;
    let invalidBetween = false;
    for (const e of usable) {
      if (e.quality[metric] !== 'valid') {
        issues.add('sensor_unavailable'); invalidBetween = true; continue;
      }
      const epoch = water ? e.water_epoch : e.energy_epoch;
      const oldEpoch = previous && (water ? previous.water_epoch : previous.energy_epoch);
      if (!previous) { previous = e; invalidBetween = false; continue; }
      if (epoch !== oldEpoch || (water && e.calibration_id !== previous.calibration_id)) {
        issues.add('counter_boundary'); previous = e; invalidBetween = false; continue;
      }
      if (e.measured_at <= previous.measured_at) { issues.add('ambiguous_time'); previous = e; continue; }
      if (invalidBetween) issues.add('sensor_gap');
      const delta = e[metric] - previous[metric];
      if (delta < 0) {
        // Sem nova época, interrompe toda a série deste contador no lote.
        issues.add('counter_decreased'); break;
      }
      const factor = water ? calibrations[e.calibration_id] : 1;
      if (!(typeof factor === 'number' && Number.isFinite(factor) && factor > 0)) {
        issues.add('unknown_calibration'); previous = e; continue;
      }
      const value = delta / factor;
      const key = water ? 'water_l' : 'energy_wh';
      result[key] += value;
      const from = localDate(previous.measured_at, timezone);
      const to = localDate(e.measured_at, timezone);
      intervals.push({ from: previous.measured_at, to: e.measured_at, metric: key, value,
        distribution_pending: from !== to });
      if (from !== to) {
        result[water ? 'unallocated_water_l' : 'unallocated_energy_wh'] += value;
        issues.add('cross_day_unallocated');
      } else {
        result.daily[to] ??= { water_l: null, energy_wh: null };
        result.daily[to][key] = (result.daily[to][key] ?? 0) + value;
      }
      previous = e; invalidBetween = false;
    }
  }
  result.issues = [...issues].sort();
  return { summary: result, intervals };
}

function summarize(events, options) {
  return computeIntervals(events, options).summary;
}

function summarizePeriod(events, options, { start, end }) {
  if (!validTime(start) || !validTime(end) || start >= end) throw new Error('Invalid period');
  const { summary, intervals } = computeIntervals(events, options);
  const result = { water_l: null, energy_wh: null,
    distribution_pending_water_l: 0, distribution_pending_energy_wh: 0,
    boundary_pending_water_l: 0, boundary_pending_energy_wh: 0,
    coverage: 'partial', issues: summary.issues };
  for (const interval of intervals) {
    if (interval.from >= start && interval.to <= end) {
      result[interval.metric] = (result[interval.metric] ?? 0) + interval.value;
      if (interval.distribution_pending) result[`distribution_pending_${interval.metric}`] += interval.value;
    } else if (interval.from < end && interval.to > start) {
      result[`boundary_pending_${interval.metric}`] += interval.value;
    }
  }
  return result;
}

function selectBaseline(days, today, stored = null, recalibrate = false) {
  // Synthetic completeness/validity flags; not a physical coverage classifier.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !validTime(`${today}T00:00:00.000Z`)) throw new Error('Invalid residence date');
  if (stored && !recalibrate) return structuredClone(stored);
  const unique = new Map();
  for (const day of days) {
    if (day.schema_version !== 2 || day.status !== 'complete' || day.valid !== true ||
        !validTime(`${day.local_date}T00:00:00.000Z`) || day.local_date >= today ||
        ![day.water_l, day.energy_wh].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)) continue;
    if (unique.has(day.local_date) && JSON.stringify(canonical(unique.get(day.local_date))) !== JSON.stringify(canonical(day))) throw new Error('Conflicting daily revisions require reconciliation');
    unique.set(day.local_date, day);
  }
  const selected = [...unique.values()].sort((a, b) => a.local_date.localeCompare(b.local_date)).slice(0, 30);
  return { phase: selected.length === 30 ? 'calibrated' : 'learning', count: selected.length,
    dates: selected.map((d) => d.local_date),
    water_l_per_day: selected.length === 30 ? selected.reduce((s, d) => s + d.water_l, 0) / 30 : null,
    energy_wh_per_day: selected.length === 30 ? selected.reduce((s, d) => s + d.energy_wh, 0) / 30 : null };
}

function allowed({ actor, action, device, payload_device = device, active = true }) {
  // Política local de exemplos. Não é Security Rules nem teste de IAM.
  if (actor.kind === 'device') {
    return active && actor.device === device &&
      ((action === 'create_event' && payload_device === device) || action === 'get_event');
  }
  if (actor.kind === 'resident') {
    return active && actor.memberships.includes(device) &&
      ['get_event', 'list_events', 'read_summary'].includes(action);
  }
  if (actor.kind === 'service') {
    return (actor.role === 'consolidator' && ['read_events', 'write_summary'].includes(action)) ||
      (actor.role === 'device_admin' && ['provision', 'revoke', 'manage_members'].includes(action));
  }
  return false;
}

module.exports = { validate, canonical, localDate, classify, summarize, summarizePeriod, selectBaseline, allowed };
