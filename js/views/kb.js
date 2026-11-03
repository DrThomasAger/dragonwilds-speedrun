// Knowledge base — a Roam-style linked wiki of everything the lab knows: runners, runs,
// splits, skips, techniques, patches, videos, transcripts, maths and analysis. Pages link
// with [[id|label]]; every page shows its linked references and unlinked mentions.
// Modes: page (default) · graph · tables · daily. Deep link: #/kb?p=<page id>.
import { h, fill, isTyping, download, fmtRun, fmtDelta, fmtClock, parseTime, debounce } from '../lib/util.js';
import * as kb from '../lib/kb-data.js';
import { drawChart } from '../lib/kb-chart.js';
import { createGraph, colorOf, TYPE_LABEL } from '../lib/kb-graph.js';

export const title = 'Knowledge';
export const keys = [['/', 'Search pages'], ['1 2 3 4', 'Page · Graph · Tables · Daily'], ['Esc', 'Clear search']];

const MODES = [['page', 'Page'], ['graph', 'Graph'], ['tables', 'Tables'], ['daily', 'Daily']];
const TYPE_ORDER = ['index', 'split', 'run', 'runner', 'skip', 'technique', 'requirement', 'build', 'post', 'wiki', 'patch', 'video', 'stream', 'thread', 'channel', 'analysis', 'math', 'phase', 'source', 'news', 'day'];
const typeLabel = t => TYPE_LABEL[t] || t[0].toUpperCase() + t.slice(1);
const singular = t => ({ index: 'hub', day: 'daily note', analysis: 'analysis', news: 'news' })[t] || t;

// UI state survives re-mounts (every link click is a hash change).
const ui = { q: '', openType: null, graphTypes: null, table: { type: 'run', sort: null, dir: 1, filter: '' }, dailyShown: 21, daily: { kind: '' } };

const href = (params) => '#/kb?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
const go = params => { location.hash = href(params); };

export async function mount(root, { params }) {
  const mode = MODES.some(m => m[0] === params.v) || params.v === 'agents' ? params.v : 'page';
  const head = h('div', { class: 'pagehead kb-head' });
  const status = h('span', { class: 'note kb-status' });
  const body = h('div', { class: 'kb' + (mode === 'page' ? ' with-refs' : ' wide') });
  root.append(head, body);
  fill(head,
    h('div', {}, h('h1', {}, 'Knowledge'), h('p', {}, 'Every run, split, skip, patch, video and transcript as linked pages — rebuilt hourly from every source.')),
    h('div', { class: 'kb-modes' }, h('div', { class: 'seg-ctl kb-tabs', role: 'tablist', 'aria-label': 'Knowledge view' },
      MODES.map(([k, l]) => h('button', { role: 'tab', class: k === mode ? 'on' : '', 'aria-selected': String(k === mode), onclick: () => go({ v: k === 'page' ? null : k, p: params.p, t: k === 'tables' ? params.t : null }) }, l))), status));

  let graph = null, painted = null, cleanupLive = null;
  const paintStatus = d => {
    const built = d.generated ? new Date(d.generated) : null;
    fill(status, built ? `Built ${built.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${built.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '', ' · ',
      d.source === 'github' ? 'live from GitHub' : 'bundled copy', ` · ${d.pages.pages.length} pages`);
  };

  function paint(d) {
    paintStatus(d);
    if (painted === d.generated) return;
    painted = d.generated;
    if (graph) { graph.destroy(); graph = null; }
    if (cleanupLive) { cleanupLive(); cleanupLive = null; }
    const side = sidebar(d, params, mode);
    const main = h('section', { class: 'kb-main', 'data-read-main': '' });
    fill(body, side, main);
    if (mode === 'graph') graph = graphView(main, d, params);
    else if (mode === 'tables') tablesView(main, d, params);
    else if (mode === 'daily') cleanupLive = dailyView(main, d);
    else if (mode === 'agents') agentsView(main);
    else { const refs = h('aside', { class: 'kb-refs', 'aria-label': 'References' }); body.append(refs); pageView(main, refs, d, params); }
  }

  // Agent Observatory: local bridge only. Its data (data/kb/agents/) is gitignored and never published.
  const tabs = head.querySelector('.kb-tabs');
  const unLive = kb.subscribeLive(l => { if (l.on && !tabs.querySelector('[data-m=agents]')) tabs.append(h('button', { role: 'tab', dataset: { m: 'agents' }, class: mode === 'agents' ? 'on' : '', 'aria-selected': String(mode === 'agents'), title: 'Agent Observatory (this PC only)', onclick: () => go({ v: 'agents' }) }, 'Agents')); });
  fill(body, h('div', { class: 'empty' }, 'Loading the knowledge base…'));
  const unsub = kb.subscribe(paint);
  kb.start().then(d => { if (!d) fill(body, h('div', { class: 'empty' }, 'The knowledge base has not been built yet. Run ', h('code', {}, 'npm run kb'), '.')); });

  const onKey = e => {
    if (e.key === 'Escape' && e.target.matches?.('.kb-search')) { e.target.value = ''; e.target.dispatchEvent(new Event('input')); e.target.blur(); return; }
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); root.querySelector('.kb-search')?.focus(); }
    else if (/^[1-4]$/.test(e.key)) { const m = MODES[+e.key - 1][0]; go({ v: m === 'page' ? null : m, p: params.p }); }
  };
  document.addEventListener('keydown', onKey);
  return () => { unsub(); unLive(); document.removeEventListener('keydown', onKey); if (graph) graph.destroy(); if (cleanupLive) cleanupLive(); };
}

// ------------------------------------------------------------------ inline text
const TOKEN = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|\[([^\]]+)\]\(([^)\s]+)\)|\*{2,3}([^*]+)\*{2,3}|`([^`]+)`|(?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])/g;
function pageLink(d, id, label) {
  const p = d.byId.get(id);
  if (!p) return h('span', { class: 'kb-missing', title: 'No page for ' + id }, label || id);
  return h('a', { href: href({ p: id }), class: 'kb-link', style: { '--c': colorOf(p.type) }, title: `${typeLabel(p.type)} · ${p.title}` }, label || p.title);
}
function inline(d, text) {
  const s = String(text ?? '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(pageLink(d, m[1], m[2]));
    else if (m[3]) out.push(/^https?:/.test(m[4]) ? h('a', { href: m[4], target: '_blank', rel: 'noopener' }, m[3]) : h('a', { href: m[4] }, m[3]));
    else if (m[5]) out.push(h('b', {}, m[5]));
    else if (m[6]) out.push(h('code', {}, m[6]));
    else if (m[7]) out.push(h('i', {}, m[7]));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
const plain = (d, text) => String(text ?? '').replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, id, l) => l || d.byId.get(id)?.title || id).replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*+|`/g, '');
const typePill = t => h('span', { class: 'pill kb-type', style: { '--c': colorOf(t) } }, singular(t));

// ------------------------------------------------------------------ sidebar
function search(d, q) {
  const w = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!w.length) return [];
  const hits = [];
  for (const p of d.pages.pages) {
    const t = p.title.toLowerCase();
    if (!w.every(x => t.includes(x) || p.id.toLowerCase().includes(x) || (p.summary || '').toLowerCase().includes(x))) continue;
    const score = (t.startsWith(w[0]) ? 0 : w.every(x => t.includes(x)) ? 1 : 2) + (p.type === 'day' ? 1 : 0);
    hits.push([score, p]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1].title.length - b[1].title.length).slice(0, 40).map(x => x[1]);
}

function sidebar(d, params, mode) {
  const cur = params.p || 'kb:home';
  const input = h('input', { type: 'search', class: 'kb-search', value: ui.q, placeholder: `Search ${d.pages.pages.length} pages…  /`, 'aria-label': 'Search the knowledge base' });
  const results = h('div', { class: 'kb-list', role: 'listbox' });
  const browse = h('div', { class: 'kb-types' });
  const paintResults = () => {
    const hits = search(d, ui.q);
    results.hidden = !ui.q.trim(); browse.hidden = !!ui.q.trim();
    fill(results, hits.length ? hits.map((p, i) => h('a', { href: href({ p: p.id }), class: 'kb-item' + (i === 0 ? ' first' : ''), role: 'option' }, h('i', { class: 'dot', style: { '--c': colorOf(p.type) } }), h('span', {}, p.title), h('small', {}, singular(p.type))))
      : h('div', { class: 'note', style: { padding: '8px' } }, 'No pages match.'));
  };
  input.addEventListener('input', debounce(() => { ui.q = input.value; paintResults(); }, 60));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = search(d, input.value)[0]; if (first) { ui.q = ''; go({ p: first.id }); } }
  });
  const types = TYPE_ORDER.filter(t => d.byType.has(t)).concat([...d.byType.keys()].filter(t => !TYPE_ORDER.includes(t)));
  const paintBrowse = () => fill(browse, h('div', { class: 'kb-cat' }, 'Browse'), types.map(t => {
    const list = d.byType.get(t);
    const open = ui.openType === t;
    return [
      h('button', { class: 'kb-typebtn' + (open ? ' on' : ''), 'aria-expanded': String(open), onclick: () => { ui.openType = open ? null : t; paintBrowse(); } },
        h('i', { class: 'dot', style: { '--c': colorOf(t) } }), h('span', {}, typeLabel(t)), h('small', {}, list.length)),
      open ? h('div', { class: 'kb-sub' }, [...list].sort((a, b) => (t === 'day' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title))).map(p => h('a', { href: href({ p: p.id }), class: 'kb-item' + (p.id === cur ? ' on' : '') }, h('span', {}, p.title)))) : null,
    ];
  }));
  const days = (d.daily.days || []).slice(0, 6);
  paintBrowse(); paintResults();
  return h('aside', { class: 'kb-side', 'aria-label': 'Knowledge index' },
    input, results, browse,
    days.length ? h('div', { class: 'kb-days' }, h('div', { class: 'kb-cat' }, 'Daily notes'),
      days.map(x => h('a', { href: href({ p: 'day:' + x.date }), class: 'kb-item' + (cur === 'day:' + x.date ? ' on' : '') }, h('span', {}, x.date), h('small', {}, x.items.length))),
      h('a', { href: href({ v: 'daily' }), class: 'kb-item more' + (mode === 'daily' ? ' on' : '') }, h('span', {}, 'Every day →'))) : null);
}

// ------------------------------------------------------------------ page
function pageView(main, refs, d, params) {
  const p = d.byId.get(params.p || 'kb:home') || d.byId.get('kb:home');
  if (!p) { fill(main, h('div', { class: 'empty' }, `No page "${params.p}".`)); return; }
  const props = Object.entries(p.props || {}).filter(([, v]) => v !== '' && v != null);
  fill(main, h('article', { class: 'card kb-page', dataset: { id: p.id } },
    h('div', { class: 'row kb-meta' }, typePill(p.type), p.updated ? h('span', { class: 'note' }, `updated ${p.updated}`) : null, h('span', { class: 'spacer' }),
      h('a', { class: 'btn sm ghost', href: href({ v: 'graph', p: p.id }), title: 'Show this page in the graph' }, '◈ Graph'),
      p.id !== 'kb:home' ? h('a', { class: 'btn sm ghost', href: href({}) }, 'Home') : null),
    h('h2', { class: 'kb-title' }, p.title),
    p.summary ? h('p', { class: 'kb-summary' }, inline(d, p.summary)) : null,
    props.length ? h('dl', { class: 'kb-props' }, props.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, inline(d, v))))) : null,
    h('div', { class: 'kb-body' }, p.body.map(b => block(d, b, p))),
    p.sources?.length ? h('details', { class: 'kb-sources' }, h('summary', { class: 'note' }, `Sources (${p.sources.length})`),
      h('ul', {}, p.sources.map(u => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, u.replace(/^https?:\/\/(www\.)?/, '')))))) : null));
  const back = p.backlinks || [], men = p.mentions || [];
  const refItem = (r, ctx) => {
    const q = d.byId.get(r.id);
    if (!q) return null;
    return h('li', { class: 'kb-ref' }, h('div', { class: 'row tight' }, h('i', { class: 'dot', style: { '--c': colorOf(q.type) } }), pageLink(d, q.id), h('small', { class: 'dim' }, singular(q.type))),
      ctx.map(c => h('div', { class: 'kb-ctx' }, c)));
  };
  const LIMIT = 40;
  const refList = (items, ctx) => {
    const ul = h('ul', { class: 'kb-refs-list' });
    const show = n => fill(ul, items.slice(0, n).map(r => refItem(r, ctx(r))), items.length > n ? h('li', {}, h('button', { class: 'btn sm', onclick: () => show(items.length) }, `Show all ${items.length}`)) : null);
    show(LIMIT);
    return ul;
  };
  fill(refs,
    h('section', { class: 'card kb-backlinks' }, h('h3', {}, `Linked references `, h('span', { class: 'pill' }, back.length)),
      back.length ? refList(back, r => r.ctx || []) : h('p', { class: 'note' }, 'Nothing links here yet.')),
    h('section', { class: 'card kb-mentions' }, h('h3', {}, 'Unlinked mentions ', h('span', { class: 'pill' }, men.length)),
      men.length ? refList(men, r => (r.ctx ? [r.ctx] : [])) : h('p', { class: 'note' }, 'No other page names this one without linking it.')));
}

function block(d, b, p) {
  try {
    switch (b.type) {
      case 'heading': return h('h3', { class: 'kb-h' }, inline(d, b.text));
      case 'paragraph': return h('p', {}, inline(d, b.text));
      case 'code': return h('pre', { class: 'kb-code' }, b.text);
      case 'list': return listBlock(d, b);
      case 'table': return tableBlock(d, b, p);
      case 'chart': return drawChart(b);
      case 'quote': return quoteBlock(d, b, p);
      default: return null;
    }
  } catch (e) { return h('div', { class: 'note' }, `Block could not be shown: ${e.message}`); }
}
function listBlock(d, b) {
  const el = h(b.ordered ? 'ol' : 'ul', { class: 'kb-ul' });
  const show = n => fill(el, b.items.slice(0, n).map(x => h('li', {}, inline(d, x))), b.items.length > n ? h('li', { class: 'more' }, h('button', { class: 'btn xs', onclick: () => show(b.items.length) }, `Show all ${b.items.length}`)) : null);
  show(40);
  return el;
}
function quoteBlock(d, b, p) {
  const src = b.source && b.source !== p.id ? d.byId.get(b.source) : null;
  const stamp = b.t != null && b.url ? h('a', { class: 'kb-stamp mono', href: b.url, target: '_blank', rel: 'noopener', title: 'Open at this moment' }, '▶ ' + fmtClock(b.t))
    : b.url ? h('a', { class: 'kb-stamp', href: b.url, target: '_blank', rel: 'noopener' }, 'source ↗') : null;
  return h('blockquote', { class: 'kb-quote' }, h('p', {}, inline(d, b.text)),
    (b.author || src || stamp) ? h('footer', {}, b.author ? h('span', {}, '— ', b.author) : null, src ? h('span', {}, ' in ', pageLink(d, src.id)) : null, stamp) : null);
}

// ------------------------------------------------------------------ tables (block + spreadsheet view share this)
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (cols, rows) => [cols, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
function sortKey(d, v) {
  if (typeof v === 'number') return v;
  const s = plain(d, v).trim();
  if (/^[−-]?\d+(:\d{1,2})+(\.\d+)?$/.test(s)) return (s.startsWith('−') || s.startsWith('-') ? -1 : 1) * parseTime(s.replace(/^[−-]/, ''));
  if (/^[+−-]?\d+(\.\d+)?$/.test(s)) return parseFloat(s.replace('−', '-'));
  return s.toLowerCase();
}
const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : typeof a === 'number' ? -1 : typeof b === 'number' ? 1 : a < b ? -1 : a > b ? 1 : 0);
function fmtCell(d, v, f) {
  if (typeof v === 'number') {
    if (f === 'time') return h('span', { class: 'mono' }, fmtRun(v));
    if (f === 'delta') return h('span', { class: 'mono ' + (v > 0.005 ? 'bad' : v < -0.005 ? 'good' : '') }, fmtDelta(v, 2));
    if (f === 'clock') return h('span', { class: 'mono' }, fmtClock(v));
    return h('span', { class: 'mono' }, String(Math.round(v * 1000) / 1000));
  }
  return inline(d, v);
}
function sortableTable(d, { columns, rows, fmt = [], name = 'table', limit = 60, filterable = false, state = null }) {
  const st = state || { sort: null, dir: 1, filter: '' };
  const wrap = h('div', { class: 'kb-table' });
  const count = h('span', { class: 'note' });
  const filter = filterable ? h('input', { type: 'search', value: st.filter, placeholder: 'Filter rows…', 'aria-label': 'Filter rows', oninput: debounce(() => { st.filter = filter.value; paint(); }, 80) }) : null;
  const exportBtn = h('button', { class: 'btn sm', onclick: () => download(`${name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'table'}.csv`, toCsv(columns, current().map(r => r.map((v, i) => (typeof v === 'number' && fmt[i] === 'time' ? fmtRun(v) : plain(d, v))))), 'text/csv') }, '⬇ Export CSV');
  const tw = h('div', { class: 'tablewrap' });
  let shown = limit;
  const current = () => {
    let r = rows;
    if (st.filter) { const q = st.filter.toLowerCase(); r = r.filter(row => row.some(v => plain(d, v).toLowerCase().includes(q))); }
    if (st.sort != null) { const i = st.sort; r = [...r].sort((a, b) => cmp(sortKey(d, a[i]), sortKey(d, b[i])) * st.dir); }
    return r;
  };
  function paint() {
    const r = current();
    const numeric = columns.map((_, i) => rows.length && rows.every(row => row[i] === '' || row[i] == null || typeof sortKey(d, row[i]) === 'number'));
    fill(count, `${r.length}${r.length !== rows.length ? ' of ' + rows.length : ''} rows`);
    fill(tw, h('table', {},
      h('thead', {}, h('tr', {}, columns.map((c, i) => h('th', { class: numeric[i] ? 'num' : '', 'aria-sort': st.sort === i ? (st.dir > 0 ? 'ascending' : 'descending') : 'none' },
        h('button', { class: 'kb-sort', onclick: () => { st.dir = st.sort === i ? -st.dir : 1; st.sort = i; paint(); } }, c, st.sort === i ? (st.dir > 0 ? ' ▲' : ' ▼') : ''))))),
      h('tbody', {}, r.slice(0, shown).map(row => h('tr', {}, row.map((v, i) => h('td', { class: numeric[i] ? 'num' : '' }, fmtCell(d, v, fmt[i]))))))),
      r.length > shown ? h('button', { class: 'btn sm kb-more', onclick: () => { shown = r.length; paint(); } }, `Show all ${r.length} rows`) : null);
  }
  paint();
  wrap.append(h('div', { class: 'row kb-tbar' }, filter, count, h('span', { class: 'spacer' }), exportBtn), tw);
  return wrap;
}
function tableBlock(d, b, p) {
  return h('div', { class: 'kb-tblock' }, b.title ? h('div', { class: 'kb-tcap' }, b.title) : null,
    sortableTable(d, { columns: b.columns, rows: b.rows, fmt: b.fmt || [], name: `${p.title} ${b.title || ''}`, filterable: b.rows.length > 15 }));
}

function tablesView(main, d, params) {
  const types = TYPE_ORDER.filter(t => d.byType.has(t));
  const type = d.byType.has(params.t) ? params.t : d.byType.has(ui.table.type) ? ui.table.type : types[0];
  if (ui.table.type !== type) Object.assign(ui.table, { type, sort: null, dir: 1, filter: '' });
  const list = d.byType.get(type) || [];
  const freq = new Map();
  for (const p of list) for (const k of Object.keys(p.props || {})) freq.set(k, (freq.get(k) || 0) + 1);
  const keys = [...freq].filter(([, n]) => n >= Math.max(1, list.length * 0.15)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
  const columns = ['Page', ...keys, 'Links', 'Linked from', 'Updated'];
  const rows = list.map(p => [`[[${p.id}]]`, ...keys.map(k => p.props?.[k] ?? ''), p.links.length, (p.backlinks || []).length, p.updated || '']);
  const pick = h('select', { 'aria-label': 'Entity type', onchange: e => go({ v: 'tables', t: e.target.value }) },
    types.map(t => h('option', { value: t, selected: t === type }, `${typeLabel(t)} (${d.byType.get(t).length})`)));
  fill(main, h('div', { class: 'card kb-sheet' },
    h('div', { class: 'row kb-sheethead' }, h('h2', {}, 'Tables'), pick, h('span', { class: 'note' }, 'Click a column to sort; filter matches any cell.')),
    sortableTable(d, { columns, rows, name: `kb-${type}`, limit: 200, filterable: true, state: ui.table })));
}

// ------------------------------------------------------------------ graph
function graphView(main, d, params) {
  const types = TYPE_ORDER.filter(t => d.byType.has(t)).concat([...d.byType.keys()].filter(t => !TYPE_ORDER.includes(t)));
  ui.graphTypes ||= new Set(types.filter(t => t !== 'day' && t !== 'news'));
  const canvas = h('canvas', { class: 'kb-canvas', 'aria-label': 'Knowledge graph: click a node to open its page' });
  const info = h('span', { class: 'note' });
  const chips = h('div', { class: 'chips kb-gchips' });
  const paintChips = () => fill(chips, types.map(t => h('button', { class: 'chip kb-gchip' + (ui.graphTypes.has(t) ? ' on' : ''), 'aria-pressed': String(ui.graphTypes.has(t)), style: { '--c': colorOf(t) },
    onclick: () => { ui.graphTypes.has(t) ? ui.graphTypes.delete(t) : ui.graphTypes.add(t); paintChips(); g.setTypes(ui.graphTypes); paintInfo(); } },
    h('i', { class: 'dot' }), typeLabel(t), h('small', {}, d.byType.get(t).length))));
  const focus = params.p && d.byId.get(params.p) ? params.p : null;
  fill(main, h('div', { class: 'card kb-graphcard' },
    h('div', { class: 'row kb-gbar' }, h('h2', {}, 'Graph'), info, h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm', onclick: () => g.zoom(1.3), 'aria-label': 'Zoom in' }, '+'), h('button', { class: 'btn sm', onclick: () => g.zoom(1 / 1.3), 'aria-label': 'Zoom out' }, '−'),
      h('button', { class: 'btn sm', onclick: () => g.fit() }, 'Fit'),
      h('button', { class: 'btn sm', onclick: () => { ui.graphTypes = new Set(types); paintChips(); g.setTypes(ui.graphTypes); paintInfo(); } }, 'All types'),
      focus ? h('a', { class: 'btn sm pri', href: href({ p: focus }) }, '‹ Back to page') : null),
    chips, canvas,
    h('p', { class: 'note' }, 'Drag to pan · wheel or pinch to zoom · drag a node to move it · click a node to open its page. Hover a node to light up its links.')));
  const g = createGraph(canvas, { nodes: d.graph.nodes, edges: d.graph.edges, focus, onOpen: id => go({ p: id }) });
  const paintInfo = () => { const s = g.stats(); fill(info, `${s.nodes} nodes · ${s.edges} links`); };
  window.__kbGraph = g;
  paintChips(); g.setTypes(ui.graphTypes); paintInfo();
  return g;
}

// ------------------------------------------------------------------ daily
function dailyView(main, d) {
  const days = d.daily.days || [];
  const kinds = [...new Set(days.flatMap(x => x.items.map(i => i.kind)))].sort();
  const liveBox = h('div');
  const list = h('div', { class: 'kb-daylist' });
  const kindSel = h('select', { 'aria-label': 'Show only', onchange: e => { ui.daily.kind = e.target.value; paint(); } }, h('option', { value: '' }, 'Everything'), kinds.map(k => h('option', { value: k, selected: k === ui.daily.kind }, k)));
  const item = i => h('li', { class: 'kb-dayitem' }, h('span', { class: 'pill kb-kind' }, i.kind),
    h('span', {}, i.id && d.byId.has(i.id) ? pageLink(d, i.id, i.text) : i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener' }, i.text) : i.text),
    i.at && i.at.length > 10 ? h('time', { class: 'note mono' }, new Date(i.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : null);
  function paint() {
    const shown = days.map(x => ({ ...x, items: ui.daily.kind ? x.items.filter(i => i.kind === ui.daily.kind) : x.items })).filter(x => x.items.length);
    fill(list, shown.slice(0, ui.dailyShown).map(x => h('section', { class: 'card kb-day' },
      h('h3', {}, pageLink(d, 'day:' + x.date, new Date(x.date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })), ' ', h('span', { class: 'pill' }, x.items.length)),
      h('ul', { class: 'kb-dayitems' }, x.items.slice(0, 60).map(item)), x.items.length > 60 ? h('a', { class: 'note', href: href({ p: 'day:' + x.date }) }, `+ ${x.items.length - 60} more on the day page`) : null)),
      shown.length > ui.dailyShown ? h('button', { class: 'btn', onclick: () => { ui.dailyShown += 30; paint(); } }, `Show older days (${shown.length - ui.dailyShown} more)`) : null,
      !shown.length ? h('div', { class: 'empty' }, 'Nothing logged for this filter.') : null);
  }
  const paintLive = live => {
    if (!live.on) { fill(liveBox); return; }
    fill(liveBox, h('section', { class: 'card kb-day kb-live' }, h('h3', {}, h('i', { class: 'kb-pulse' }), 'Live from the lab ', h('span', { class: 'pill new' }, live.events.length)),
      live.events.length ? h('ul', { class: 'kb-dayitems' }, live.events.slice(0, 40).map(e => h('li', { class: 'kb-dayitem' }, h('span', { class: 'pill kb-kind' }, `${e.source || 'app'}/${e.type || 'event'}`), h('span', {}, e.text || ''), e.at ? h('time', { class: 'note mono' }, new Date(e.at).toLocaleTimeString()) : null)))
        : h('p', { class: 'note' }, 'Waiting for splits, PBs, practice and game events…')));
  };
  fill(main, h('div', { class: 'row kb-dayhead' }, h('h2', {}, 'Daily notes'), h('span', { class: 'note' }, `${days.length} days · newest first`), h('span', { class: 'spacer' }), kindSel), liveBox, list);
  paint();
  return kb.subscribeLive(paintLive);
}

// ------------------------------------------------------------------ Agent Observatory (local bridge only)
// Reads data/kb/agents/metrics.json from the local server. That folder is gitignored and is
// never compiled into the published knowledge base; on the public site this view shows nothing.
async function agentsView(main) {
  for (let i = 0; i < 30 && !kb.liveFeed().on; i++) await new Promise(r => setTimeout(r, 100));
  const live = kb.liveFeed();
  if (!live.on) { fill(main, h('div', { class: 'empty' }, 'The Agent Observatory is only available in the local lab (bb lab).')); return; }
  fill(main, h('div', { class: 'empty' }, 'Loading agent metrics…'));
  let m;
  try { const r = await fetch('data/kb/agents/metrics.json', { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); m = await r.json(); }
  catch (e) { fill(main, h('div', { class: 'empty' }, 'No agent metrics on this PC yet (data/kb/agents/metrics.json): ' + e.message)); return; }
  const METRICS = [['adherence', 'Instruction adherence'], ['cooperation', 'Cooperation'], ['harmony', 'Harmony'], ['gathering', 'Gathering']];
  const src = Object.entries(m.bySource || {});
  const months = (m.monthly || []).filter(x => METRICS.some(([k]) => x[k] != null));
  const t = m.totals || {};
  const tile = (label, v) => h('div', {}, label, h('b', {}, v == null ? '—' : typeof v === 'number' ? v.toLocaleString() : v));
  fill(main, h('div', { class: 'card kb-agents' },
    h('div', { class: 'row kb-gbar' }, h('h2', {}, 'Agent Observatory'), h('span', { class: 'pill warn' }, 'this PC only · never published'), h('span', { class: 'spacer' }), m.generated ? h('span', { class: 'note' }, 'metrics ' + m.generated.slice(0, 16).replace('T', ' ')) : null),
    h('p', { class: 'note' }, 'How well the AI assistants follow instructions and work with you, from your own conversation exports.', m.method ? ' Method: ' + m.method + '.' : ''),
    h('div', { class: 'facts' }, tile('Conversations', t.conversations), tile('Requests', t.requests), tile('Corrections', t.corrections), tile('Repeats', t.repeats), tile('Completions', t.completions), tile('Failures', t.failures)),
    src.length ? drawChart({ kind: 'bar', title: 'By source (0–100)', labels: src.map(([k]) => k), series: METRICS.map(([k, l]) => ({ name: l, values: src.map(([, v]) => (v[k] == null ? NaN : v[k])) })) }) : null,
    months.length > 1 ? drawChart({ kind: 'line', title: 'Month by month (0–100)', xLabels: months.map(x => x.period.slice(2)), series: METRICS.map(([k, l]) => ({ name: l, points: months.map((x, i) => [i + 1, x[k]]).filter(p => p[1] != null) })) }) : null,
    (m.topCorrections || []).length ? [h('h3', { class: 'kb-h' }, 'What gets corrected most'), sortableTable({ byId: new Map() }, { columns: ['Theme', 'Count'], rows: m.topCorrections.map(c => [c.theme, c.count]), name: 'agent-corrections', limit: 20 })] : null));
}
