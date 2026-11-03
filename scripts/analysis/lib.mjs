// Shared helpers for the analysis engine: counter-based RNG (common random
// numbers), distributions, summary statistics, CSV/JSON output, paths.
// No dependencies; Node 18+ ESM.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'data', 'kb', 'analysis');
export const DOCS_DIR = join(ROOT, 'docs', 'math');
export const RUNPATH_DEFAULT = 'D:/claude-temp/runpath/runpath.json';

// ---------- randomness ----------
// mulberry32 finaliser used as a 32-bit integer hash.
export function mix(a) {
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}
export function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
// Counter-based uniform in (0,1): the same (seed, run, key, j) always gives the
// same number, so two scenarios that differ only in a parameter see identical
// luck ("common random numbers") and their difference has very low noise.
export function U(seed, run, key, j = 0) {
  return (mix(mix(mix(seed ^ key) + run) + j * 0x9E3779B1) + 0.5) / 4294967296;
}
export function Z(seed, run, key, j = 0) {
  const u1 = U(seed, run, key, 2 * j), u2 = U(seed, run, key, 2 * j + 1);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
// Sequential seeded generator (for drawing posterior parameter samples etc.).
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; return (mix(s) + 0.5) / 4294967296; };
  next.normal = () => Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());
  next.gamma = (k) => { // Marsaglia–Tsang, shape k, scale 1
    if (k < 1) return next.gamma(k + 1) * Math.pow(next(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = next.normal(); v = 1 + c * x; } while (v <= 0);
      v = v * v * v; const u = next();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  next.beta = (a, b) => { const x = next.gamma(a), y = next.gamma(b); return x / (x + y); };
  return next;
}

// ---------- stats ----------
export const sum = a => a.reduce((x, y) => x + y, 0);
export const mean = a => (a.length ? sum(a) / a.length : null);
export function sd(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
export function quantileSorted(s, q) {
  if (!s.length) return null;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
export const quantile = (a, q) => quantileSorted([...a].sort((x, y) => x - y), q);
export const median = a => quantile(a, 0.5);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf).
export function phi(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + Math.sign(x) * y);
}

// ---------- formatting ----------
export const r2 = x => (x == null || !isFinite(x) ? x : Math.round(x * 100) / 100);
export const r4 = x => (x == null || !isFinite(x) ? x : Math.round(x * 10000) / 10000);
export function fmt(t, dp = 2) {
  if (t == null) return '—';
  if (!isFinite(t)) return 'DNF';
  const sign = t < 0 ? '-' : '';
  t = Math.abs(t);
  const m = Math.floor(t / 60), s = t - 60 * m;
  return `${sign}${m}:${s.toFixed(dp).padStart(dp ? 3 + dp : 2, '0')}`;
}
export const pct = (p, dp = 2) => (p == null ? '—' : `${(100 * p).toFixed(dp)}%`);

// ---------- IO ----------
export function readJSON(path, fallback = undefined) {
  if (!existsSync(path)) { if (fallback !== undefined) return fallback; throw new Error(`missing ${path}`); }
  const txt = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(txt);
}
export function readJSONL(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}
function guardPath(p) {
  const abs = resolve(p);
  if (/^c:/i.test(abs)) throw new Error(`refusing to write to C: (${abs})`);
  return abs;
}
export function writeJSON(path, obj) {
  const abs = guardPath(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n');
  return abs;
}
export function writeText(path, txt) {
  const abs = guardPath(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, txt);
  return abs;
}
const csvCell = v => {
  if (v == null) return '';
  const s = typeof v === 'number' ? (isFinite(v) ? String(Math.round(v * 10000) / 10000) : '') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCSV(rows, cols) {
  cols = cols || [...new Set(rows.flatMap(r => Object.keys(r)))];
  return [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n') + '\n';
}
export const writeCSV = (path, rows, cols) => writeText(path, toCSV(rows, cols));

// ---------- CLI ----------
export function args(argv = process.argv.slice(2)) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) o[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
    else o[k] = true;
  }
  return o;
}
export const isMain = (url) => {
  const p = process.argv[1] && resolve(process.argv[1]);
  return p && resolve(fileURLToPath(url)) === p;
};
