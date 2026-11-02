// Hash router. Each view exports { title, keys?, mount(el, params) -> cleanup }.
import * as store from './lib/store.js';
import { h, $, $$, isTyping, fmtRun } from './lib/util.js';
import { RECORD } from './data/raid.js';

const views = {
  hq: () => import('./views/hq.js'),
  compare: () => import('./views/compare.js'),
  route: () => import('./views/route.js'),
  studio: () => import('./views/studio.js'),
  practice: () => import('./views/practice.js'),
  timer: () => import('./views/timer.js'),
  library: () => import('./views/library.js'),
  hardcore: () => import('./views/hardcore.js'),
};

const GLOBAL_KEYS = [['?', 'This help'], ['g h', 'HQ'], ['g c', 'Race the WR'], ['g r', 'Route'], ['g s', 'Reel Studio'], ['g p', 'Practice'], ['g t', 'Timer'], ['g l', 'Library']];

store.load();
let cleanup = null, current = null, seq = 0;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name, ...rest] = path.split('/');
  return { name: views[name] ? name : 'hq', rest, params: Object.fromEntries(new URLSearchParams(query)) };
}

async function route() {
  const { name, rest, params } = parseHash();
  const my = ++seq;
  const mod = await views[name]();
  if (my !== seq) return;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  const el = $('#view');
  el.replaceChildren();
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === name));
  document.title = `${mod.title} · Dragonwilds Raid Lab`;
  current = mod;
  renderKeys(mod.keys || []);
  try { cleanup = (await mod.mount(el, { rest, params })) || null; }
  catch (e) {
    console.error(e);
    el.append(h('div', { class: 'card' }, h('h2', {}, 'Something went wrong'), h('pre', { class: 'note' }, String(e.stack || e))));
  }
  if (!params.keep) window.scrollTo(0, 0);
}

function renderKeys(viewKeys) {
  $('#keys').replaceChildren(...[...GLOBAL_KEYS, ...viewKeys].map(([k, d]) => h('div', {}, h('span', {}, d), h('span', {}, k.split(' ').map(x => h('kbd', {}, x))))));
}

let gPending = 0;
document.addEventListener('keydown', e => {
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); const d = $('#help'); d.open ? d.close() : d.showModal(); return; }
  if (e.key === 'g') { gPending = Date.now(); return; }
  if (Date.now() - gPending < 900) {
    const map = { h: 'hq', c: 'compare', r: 'route', s: 'studio', p: 'practice', t: 'timer', l: 'library' };
    if (map[e.key]) { e.preventDefault(); location.hash = '#/' + map[e.key]; gPending = 0; return; }
  }
  if (current && current.onKey) current.onKey(e);
});
$('#helpBtn').addEventListener('click', () => $('#help').showModal());

$('#topTarget').replaceChildren('#1 to beat ', h('b', {}, fmtRun(RECORD.time)), ` · ${RECORD.runner}`);
window.addEventListener('hashchange', route);
route();
