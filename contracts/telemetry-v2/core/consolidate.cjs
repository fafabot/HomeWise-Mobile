'use strict';

// Local only. No SDK, network, filesystem, timers or production adapter.
const { createHash } = require('node:crypto');
const { validate, localDate } = require('../reference.cjs');
const METRICS = [
  { name: 'water_l', field: 'water_pulses_total', epoch: 'water_epoch' },
  { name: 'energy_wh', field: 'energy_total_wh', epoch: 'energy_epoch' },
];

function stable(value) {
  // Typed representation also distinguishes malformed null/undefined/NaN payloads.
  if (value === null) return ['null'];
  if (Array.isArray(value)) return ['array', value.map(stable)];
  if (typeof value === 'object') return ['object', Object.keys(value).sort().map((k) => [k, stable(value[k])])];
  return [typeof value, String(value)];
}
const hash = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const eventId = (e) => `${e.boot_id}__${e.seq}`;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const byTime = (a, b) => compare(a.measured_at, b.measured_at) || compare(eventId(a), eventId(b));
function time(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function sum(values) {
  // Stable ordering + compensated summation; no display rounding in the core.
  if (!values.length) return null;
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const y = value - correction;
    const next = total + y;
    correction = (next - total) - y;
    total = next;
  }
  if (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER) throw new RangeError('Total exceeds numeric envelope');
  return total;
}

function optionsFor(input) {
  if (!input || typeof input.device_id !== 'string' || !/^(?!.*__)[A-Za-z0-9_-]{1,64}$/.test(input.device_id)) throw new Error('Invalid device_id');
  localDate('2026-01-01T00:00:00.000Z', input.timezone);
  if (typeof input.timezone !== 'string' || !input.timezone) throw new Error('Residence timezone required');
  const options = structuredClone(input);
  options.calibrations ??= {};
  if (typeof options.calibrations !== 'object' || Array.isArray(options.calibrations)) throw new Error('Invalid calibrations');
  for (const factor of Object.values(options.calibrations)) {
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) throw new Error('Invalid pulses-per-liter calibration');
  }
  options.continuity ??= [];
  if (!Array.isArray(options.continuity) || options.continuity.some((p) => !METRICS.some((m) => m.name === p.metric) ||
      typeof p.from !== 'string' || typeof p.to !== 'string')) throw new Error('Invalid continuity evidence');
  return options;
}

function consolidate(events, suppliedOptions) {
  if (!Array.isArray(events)) throw new Error('Event array required');
  const options = optionsFor(suppliedOptions);
  const diagnostics = new Map();
  const note = (code, event_id, metric = null) => {
    const entry = { code, event_id, metric };
    diagnostics.set(JSON.stringify(entry), entry);
  };
  const versions = new Map();
  for (const event of events) {
    if (validate(event).length) {
      note('invalid_event', `invalid-${hash(event)}`);
      continue;
    }
    if (event.device_id !== options.device_id) { note('wrong_device', `${event.device_id}/${eventId(event)}`); continue; }
    const id = eventId(event);
    if (!versions.has(id)) versions.set(id, new Map());
    versions.get(id).set(hash(event), structuredClone(event));
  }
  const ordered = [];
  for (const [id, candidates] of versions) {
    if (candidates.size !== 1) { note('id_conflict', id); continue; }
    const event = [...candidates.values()][0];
    if (event.clock_quality !== 'synced') { note('clock_uncertain', id); continue; }
    ordered.push(event);
  }
  ordered.sort(byTime);
  const boots = new Map();
  for (const e of ordered) {
    if (!boots.has(e.boot_id)) boots.set(e.boot_id, []);
    boots.get(e.boot_id).push(e);
  }
  const invalidBoots = new Set();
  for (const [boot, samples] of boots) {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      if (b.seq <= a.seq || b.uptime_ms <= a.uptime_ms || b.measured_at <= a.measured_at) {
        invalidBoots.add(boot); note('order_inconsistent', eventId(b));
      }
      if (b.seq !== a.seq + 1) note('sequence_gap', eventId(b));
    }
  }
  // Interleaving boots contradict a single device's trusted UTC timeline.
  const ranges = [...boots.entries()].map(([boot, samples]) => ({ boot, first: samples[0], last: samples.at(-1) }));
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.first.measured_at <= b.last.measured_at && b.first.measured_at <= a.last.measured_at) {
        invalidBoots.add(a.boot); invalidBoots.add(b.boot);
        note('boot_overlap', a.boot); note('boot_overlap', b.boot);
      }
    }
  }
  const usable = ordered.filter((e) => !invalidBoots.has(e.boot_id));
  const contributions = [];
  for (const metric of METRICS) {
    let previous = null;
    let gap = false;
    let blocked = false;
    let currentEpoch = null;
    const seenEpochs = new Set();
    for (const e of usable) {
      const epoch = e[metric.epoch];
      if (epoch !== currentEpoch) {
        blocked = seenEpochs.has(epoch);
        if (blocked) note('epoch_reused', eventId(e), metric.name);
        if (currentEpoch !== null) note('counter_boundary', eventId(e), metric.name);
        seenEpochs.add(epoch); currentEpoch = epoch; previous = null; gap = false;
      }
      if (e.quality[metric.field] !== 'valid') {
        note('sensor_unavailable', eventId(e), metric.name); gap = true; continue;
      }
      if (blocked) continue;
      if (!previous) { previous = e; gap = false; continue; }
      if (metric.name === 'water_l' && e.calibration_id !== previous.calibration_id) {
        note('calibration_boundary', eventId(e), metric.name); previous = e; gap = false; continue;
      }
      const crossingBoot = previous.boot_id !== e.boot_id;
      const proof = options.continuity.some((p) => p.metric === metric.name && p.from === eventId(previous) && p.to === eventId(e));
      if (crossingBoot && !proof) {
        note('continuity_unproven', eventId(e), metric.name); previous = e; gap = false; continue;
      }
      const delta = e[metric.field] - previous[metric.field];
      if (delta < 0) {
        note('counter_decreased', eventId(e), metric.name); blocked = true; continue;
      }
      if (gap) note('sensor_gap', eventId(e), metric.name);
      const factor = metric.name === 'water_l' ? options.calibrations[e.calibration_id] : 1;
      if (!Object.hasOwn(options.calibrations, e.calibration_id) && metric.name === 'water_l') {
        note('unknown_calibration', eventId(e), metric.name); previous = e; gap = false; continue;
      }
      const value = delta / factor;
      if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) {
        note('numeric_overflow', eventId(e), metric.name); blocked = true; continue;
      }
      const start = previous.measured_at;
      const end = e.measured_at;
      const firstDay = localDate(start, options.timezone);
      // A sample exactly at midnight closes the previous interval without a split.
      const lastDay = localDate(new Date(Date.parse(end) - 1).toISOString(), options.timezone);
      const pending = firstDay !== lastDay;
      const hasGap = gap || (!crossingBoot && e.seq !== previous.seq + 1);
      if (hasGap) note('interval_gap', eventId(e), metric.name);
      contributions.push({ id: `${metric.name}/${eventId(previous)}/${eventId(e)}`,
        metric: metric.name, from_event: eventId(previous), to_event: eventId(e),
        epoch, calibration_id: metric.name === 'water_l' ? e.calibration_id : null,
        start, end, value, local_date: pending ? null : firstDay,
        distribution_pending: pending, has_gap: hasGap });
      previous = e; gap = false;
    }
  }
  contributions.sort((a, b) => compare(a.start, b.start) || compare(a.id, b.id));
  const daily = {};
  for (const date of [...new Set(contributions.map((c) => c.local_date).filter(Boolean))].sort()) {
    const within = contributions.filter((c) => c.local_date === date);
    daily[date] = { water_l: sum(within.filter((c) => c.metric === 'water_l').map((c) => c.value)),
      energy_wh: sum(within.filter((c) => c.metric === 'energy_wh').map((c) => c.value)), coverage: 'partial' };
  }
  const totals = {};
  const unallocated = {};
  for (const { name } of METRICS) {
    totals[name] = sum(contributions.filter((c) => c.metric === name).map((c) => c.value));
    unallocated[name] = sum(contributions.filter((c) => c.metric === name && c.distribution_pending).map((c) => c.value));
  }
  const latestEvent = usable.at(-1);
  const latest = latestEvent ? { event_id: eventId(latestEvent), measured_at: latestEvent.measured_at,
    fields: Object.fromEntries(['water_pulses_total', 'energy_total_wh', 'flow_l_min', 'power_w', 'voltage_v']
      .map((field) => [field, { value: latestEvent[field], quality: latestEvent.quality[field] }])) } : null;
  const result = { aggregation_version: 'local-core-1', device_id: options.device_id,
    timezone: options.timezone, coverage: 'partial', totals, daily, unallocated,
    contributions, latest, diagnostics: [...diagnostics.values()].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))) };
  return { ...result, revision: hash(result) };
}

function summarizePeriod(result, { start, end }) {
  if (!time(start) || !time(end) || start >= end) throw new Error('Invalid UTC period bounds');
  const contained = result.contributions.filter((c) => c.start >= start && c.end <= end);
  const crossing = result.contributions.filter((c) => !(c.start >= start && c.end <= end) && c.start < end && c.end > start);
  const summary = { water_l: null, energy_wh: null, distribution_pending_water_l: 0,
    distribution_pending_energy_wh: 0, boundary_pending_water_l: 0, boundary_pending_energy_wh: 0,
    coverage: 'partial', revision: result.revision, included_contributions: contained.map((c) => c.id),
    boundary_contributions: crossing.map((c) => c.id) };
  for (const { name } of METRICS) {
    summary[name] = sum(contained.filter((c) => c.metric === name).map((c) => c.value));
    summary[`distribution_pending_${name}`] = sum(contained.filter((c) => c.metric === name && c.distribution_pending).map((c) => c.value)) ?? 0;
    summary[`boundary_pending_${name}`] = sum(crossing.filter((c) => c.metric === name).map((c) => c.value)) ?? 0;
  }
  return summary;
}

function createLocalConsolidator(options) {
  const fixed = optionsFor(options);
  let variants = new Map();
  return {
    ingest(events) {
      if (!Array.isArray(events)) throw new Error('Event array required');
      const candidate = new Map(variants);
      for (const e of events) candidate.set(hash(e), structuredClone(e));
      const result = consolidate([...candidate.values()], fixed);
      variants = candidate;
      return result;
    },
    snapshot() { return consolidate([...variants.values()], fixed); },
  };
}

module.exports = { consolidate, summarizePeriod, createLocalConsolidator };
