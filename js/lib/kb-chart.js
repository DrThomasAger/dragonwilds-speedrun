// Small SVG charts for knowledge-base pages, drawn from the chart spec in pages.json:
//   line / scatter: { series: [{ name, points: [[x, y, label?]] }], xLabels?, xType?: 'date', fmt? }
//   bar:            { labels: [..], series: [{ name, values: [..] }], fmt? }
//   histogram:      { values: [..], bins?, fmt? }
// fmt: 'time' (run time), 'delta' (± seconds), 'clock' (video time) or plain numbers.
import { h, fmtRun, fmtDelta, fmtClock } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const S = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
};
export const SERIES = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--violet)', 'var(--good)'];

const fmtShort = (v, fmt) => {
  if (fmt === 'time') return fmtRun(v, Math.abs(v) < 60 ? 1 : 0);
  if (fmt === 'delta') return fmtDelta(v, Math.abs(v) < 10 ? 1 : 0);
  if (fmt === 'clock') return fmtClock(v);
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : a >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(a < 1 ? 2 : 1);
};
const fmtFull = (v, fmt) => (fmt === 'time' ? fmtRun(v) : fmt === 'delta' ? fmtDelta(v, 2) : fmt === 'clock' ? fmtClock(v, true) : String(Math.round(v * 1000) / 1000));
const toDate = x => (typeof x === 'string' ? Date.parse(x.length === 10 ? x + 'T00:00:00Z' : x) : x);
const fmtDate = ms => new Date(ms).toISOString().slice(5, 10);

function ticks(lo, hi, n = 5) {
  if (!isFinite(lo) || !isFinite(hi)) return [0];
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function drawChart(spec) {
  const fig = h('figure', { class: 'kb-chart' });
  if (spec.title) fig.append(h('figcaption', {}, spec.title));
  try {
    const svg = spec.kind === 'bar' ? bar(spec) : spec.kind === 'histogram' ? histogram(spec) : xy(spec);
    fig.append(svg);
    const names = spec.kind === 'histogram' ? [] : (spec.series || []).map(s => s.name).filter(Boolean);
    if (names.length > 1) fig.append(h('div', { class: 'kb-legend' }, names.map((n, i) => h('span', {}, h('i', { class: 'dot', style: { '--c': SERIES[i % SERIES.length] } }), n))));
  } catch (e) { fig.append(h('div', { class: 'note' }, 'Chart could not be drawn: ' + e.message)); }
  return fig;
}

function frame(W, H, m, yt, yScale, fmt) {
  const g = S('g', { class: 'axis' });
  for (const v of yt) {
    const y = yScale(v);
    g.append(S('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: v === 0 ? 'zero' : 'grid' }), S('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end' }, fmtShort(v, fmt)));
  }
  return g;
}

function xy(spec) {
  const W = 640, H = 250, m = { l: 56, r: 14, t: 12, b: 30 };
  const date = spec.xType === 'date';
  const series = (spec.series || []).map(s => ({ ...s, pts: (s.points || []).map(p => [date ? toDate(p[0]) : +p[0], +p[1], p[2]]).filter(p => isFinite(p[0]) && isFinite(p[1])) }));
  const all = series.flatMap(s => s.pts);
  if (!all.length) throw new Error('no points');
  let [x0, x1] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))];
  let [y0, y1] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
  if (x0 === x1) { x0 -= date ? 864e5 : 1; x1 += date ? 864e5 : 1; }
  const pad = (y1 - y0 || Math.abs(y1) || 1) * 0.08; y0 -= pad; y1 += pad;
  if (spec.fmt === 'delta') { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
  const yt = ticks(y0, y1);
  y0 = Math.min(y0, yt[0]); y1 = Math.max(y1, yt[yt.length - 1]);
  const xs = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r), ys = y => H - m.b - (y - y0) / (y1 - y0) * (H - m.t - m.b);
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || 'chart' }, frame(W, H, m, yt, ys, spec.fmt));
  const xg = S('g', { class: 'axis' });
  if (spec.xLabels) spec.xLabels.forEach((l, i) => xg.append(S('text', { x: xs(i + 1), y: H - 10, 'text-anchor': 'middle' }, l)));
  else ticks(x0, x1, date ? 4 : 6).forEach(v => { if (v >= x0 && v <= x1) xg.append(S('text', { x: xs(v), y: H - 10, 'text-anchor': 'middle' }, date ? fmtDate(v) : fmtShort(v))); });
  svg.append(xg);
  series.forEach((s, i) => {
    const c = SERIES[i % SERIES.length];
    const pts = [...s.pts].sort((a, b) => a[0] - b[0]);
    if (spec.kind !== 'scatter' && pts.length > 1) svg.append(S('polyline', { points: pts.map(p => `${xs(p[0]).toFixed(1)},${ys(p[1]).toFixed(1)}`).join(' '), fill: 'none', style: `stroke:${c}`, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    for (const p of pts) svg.append(S('circle', { cx: xs(p[0]).toFixed(1), cy: ys(p[1]).toFixed(1), r: spec.kind === 'scatter' ? 4.5 : 3.5, style: `fill:${c}`, class: 'pt' },
      S('title', {}, `${p[2] || s.name || ''}${p[2] || s.name ? ' · ' : ''}${date ? new Date(p[0]).toISOString().slice(0, 10) : spec.xLabels ? spec.xLabels[p[0] - 1] || p[0] : fmtShort(p[0])}: ${fmtFull(p[1], spec.fmt)}`)));
  });
  return svg;
}

function bar(spec) {
  const labels = spec.labels || [];
  const series = spec.series || [];
  const n = labels.length, k = Math.max(1, series.length);
  const rot = n > 7 || labels.some(l => String(l).length > 12);
  const W = 640, H = rot ? 280 : 240, m = { l: 56, r: 10, t: 12, b: rot ? 74 : 30 };
  const vals = series.flatMap(s => s.values || []).filter(isFinite);
  if (!vals.length) throw new Error('no values');
  let y0 = Math.min(0, ...vals), y1 = Math.max(0, ...vals);
  const yt = ticks(y0, y1 * 1.05 || 1);
  y0 = Math.min(y0, yt[0]); y1 = Math.max(y1, yt[yt.length - 1]);
  const ys = y => H - m.b - (y - y0) / (y1 - y0 || 1) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / Math.max(1, n), bw = Math.max(2, (band * 0.78) / k);
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || 'bar chart' }, frame(W, H, m, yt, ys, spec.fmt));
  labels.forEach((l, i) => {
    const cx = m.l + band * (i + 0.5);
    const short = String(l).length > 18 ? String(l).slice(0, 17) + '…' : String(l);
    svg.append(rot ? S('text', { x: cx, y: H - m.b + 12, 'text-anchor': 'end', transform: `rotate(-35 ${cx} ${H - m.b + 12})`, class: 'axis-l' }, short) : S('text', { x: cx, y: H - 10, 'text-anchor': 'middle', class: 'axis-l' }, short));
    series.forEach((s, j) => {
      const v = (s.values || [])[i]; if (!isFinite(v)) return;
      const x = cx - (bw * k) / 2 + j * bw, y = ys(Math.max(0, v)), hgt = Math.abs(ys(v) - ys(0));
      svg.append(S('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (bw - 1).toFixed(1), height: Math.max(0.5, hgt).toFixed(1), rx: 2, style: `fill:${SERIES[j % SERIES.length]}`, class: 'bar' },
        S('title', {}, `${l}${s.name ? ' · ' + s.name : ''}: ${fmtFull(v, spec.fmt)}`)));
    });
  });
  return svg;
}

function histogram(spec) {
  const v = (spec.values || []).map(Number).filter(isFinite);
  if (!v.length) throw new Error('no values');
  const lo = Math.min(...v), hi = Math.max(...v);
  const nb = spec.bins || Math.min(30, Math.max(6, Math.ceil(Math.sqrt(v.length))));
  const w = (hi - lo) / nb || 1;
  const counts = new Array(nb).fill(0);
  for (const x of v) counts[Math.min(nb - 1, Math.floor((x - lo) / w))]++;
  const W = 640, H = 220, m = { l: 44, r: 10, t: 12, b: 30 };
  const yt = ticks(0, Math.max(...counts));
  const y1 = Math.max(...yt, 1);
  const xs = x => m.l + (x - lo) / (w * nb) * (W - m.l - m.r), ys = y => H - m.b - y / y1 * (H - m.t - m.b);
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || 'histogram' }, frame(W, H, m, yt, ys));
  counts.forEach((c, i) => {
    const a = lo + i * w;
    svg.append(S('rect', { x: xs(a).toFixed(1), y: ys(c).toFixed(1), width: Math.max(1, xs(a + w) - xs(a) - 1).toFixed(1), height: (ys(0) - ys(c)).toFixed(1), style: 'fill:var(--c1)', class: 'bar' },
      S('title', {}, `${fmtFull(a, spec.fmt)} – ${fmtFull(a + w, spec.fmt)}: ${c}`)));
  });
  const xg = S('g', { class: 'axis' });
  ticks(lo, lo + w * nb, 6).forEach(t => { if (t >= lo && t <= lo + w * nb) xg.append(S('text', { x: xs(t), y: H - 10, 'text-anchor': 'middle' }, fmtShort(t, spec.fmt))); });
  svg.append(xg);
  return svg;
}
