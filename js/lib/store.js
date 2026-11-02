// One versioned localStorage document for everything a runner does on the site.
// Everything is exportable / importable as JSON so it can move between machines.

const KEY = 'dw_lab_v2';
const LEGACY = 'dw_hc_route_v1';

const defaults = () => ({
  version: 2,
  runs: {},          // runKey -> { offset, splits:[...] } user corrections to reference split marks
  customRuns: [],    // your own run videos: { key, runner, label, vid, offset, splits, time }
  clips: {},         // clipKey -> { in, out } user corrections to library / route clips
  reels: [],         // user reels: { id, name, clips:[{vid,in,out,label}] }
  practice: {},      // skipId -> { log:[{t, ok}], lost: seconds lost when it fails (user estimate) }
  timer: { pb: null, best: [], attempts: [], comparison: 'tp650', runs: 0, resets: 0, imported: null },
  hardcore: { done: {}, phase: 'p0' },
  prefs: { compareRuns: ['tp650', 'nano701'], compareMode: 'race', rate: 1, layout: 'grid' },
  src: null,         // cached speedrun.com leaderboard { at, rows }
});

let state = defaults();
const subs = new Set();

function migrate(s) {
  const d = defaults();
  const out = { ...d, ...s };
  for (const k of ['timer', 'hardcore', 'prefs']) out[k] = { ...d[k], ...(s[k] || {}) };
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = migrate(JSON.parse(raw));
    else {
      const old = localStorage.getItem(LEGACY);
      if (old) {
        const o = JSON.parse(old);
        state.hardcore = { done: o.done || {}, phase: o.phase || 'p0' };
      }
    }
  } catch { state = defaults(); }
  return state;
}

// Written synchronously: an installed app can be closed at any moment.
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  subs.forEach(f => f(state));
}

export const get = () => state;
export function update(fn) { fn(state); save(); }
export const subscribe = f => (subs.add(f), () => subs.delete(f));

export function exportAll() { return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1); }
export function importAll(text) {
  const s = JSON.parse(text);
  if (!s || s.version !== 2) throw new Error('Not a Dragonwilds raid lab export');
  state = migrate(s); save();
}
export function resetAll() { state = defaults(); save(); }
