// Hash router + app shell. Each view exports { title, keys?, mount(el, ctx) -> cleanup }.
import * as store from './lib/store.js';
import { h, $, $$, isTyping, fmtRun, fill } from './lib/util.js';
import { RECORD } from './data/raid.js';
import * as patches from './lib/patches.js';
import { initPWA } from './lib/pwa.js';
import { initPalette } from './lib/palette.js';
import { initBridge } from './lib/bridge.js';
import * as voice from './lib/speak.js';

const views = {
  hq: () => import('./views/hq.js'),
  today: () => import('./views/today.js'),
  run: () => import('./views/run.js'),
  compare: () => import('./views/compare.js'),
  route: () => import('./views/route.js'),
  studio: () => import('./views/studio.js'),
  practice: () => import('./views/practice.js'),
  timer: () => import('./views/timer.js'),
  wiki: () => import('./views/wiki.js'),
  kb: () => import('./views/kb.js'),
  patches: () => import('./views/patches.js'),
  library: () => import('./views/library.js'),
  hardcore: () => import('./views/hardcore.js'),
};

const GLOBAL_KEYS = [['?', 'This help'], ['Ctrl Shift Esc', 'Stop speech'], ['Ctrl K', 'Search everything'], ['g h', 'HQ'], ['g n', 'Run navigator'], ['g c', 'Race the WR'], ['g r', 'Route'], ['g s', 'Reel Studio'], ['g p', 'Practice'], ['g t', 'Timer'], ['g w', 'Wiki'], ['g k', 'Knowledge'], ['g u', 'Patch notes'], ['g l', 'Library']];

store.load();
let cleanup = null, seq = 0;

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
  fill(el);
  $$('#nav a, #moreGrid a').forEach(a => a.classList.toggle('on', a.dataset.r === name));
  $('#moreBtn').classList.toggle('on', !$(`#nav a[data-r="${name}"][data-p]`));
  document.title = `${mod.title} · Dragonwilds Raid Lab`;
  $('#viewTitle').textContent = mod.title;
  $('#more').open && $('#more').close();
  renderKeys(mod.keys || []);
  try { cleanup = (await mod.mount(el, { rest, params })) || null; }
  catch (e) {
    console.error(e);
    el.append(h('div', { class: 'card' }, h('h2', {}, 'Something went wrong'), h('pre', { class: 'note' }, String(e.stack || e))));
  }
  if (!params.keep) window.scrollTo(0, 0);
}

function renderKeys(viewKeys) {
  fill($('#keys'), ...[...GLOBAL_KEYS, ...viewKeys].map(([k, d]) => h('div', {}, h('span', {}, d), h('span', {}, k.split(' ').map(x => h('kbd', {}, x))))));
}

// "More" sheet on phones lists every section.
fill($('#moreGrid'), ...$$('#nav a').map(a => h('a', { href: a.getAttribute('href'), dataset: { r: a.dataset.r } }, h('b', {}, a.querySelector('b').textContent), a.querySelector('span').textContent)));
$('#moreBtn').addEventListener('click', () => $('#more').showModal());
$('#more').addEventListener('click', e => { if (e.target === $('#more') || e.target.closest('a')) $('#more').close(); });

let gPending = 0;
document.addEventListener('keydown', e => {
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); const d = $('#help'); d.open ? d.close() : d.showModal(); return; }
  if (e.key === 'g') { gPending = Date.now(); return; }
  if (Date.now() - gPending < 900) {
    const map = { d: 'today', h: 'hq', n: 'run', c: 'compare', r: 'route', s: 'studio', p: 'practice', t: 'timer', w: 'wiki', k: 'kb', u: 'patches', l: 'library' };
    if (map[e.key]) { e.preventDefault(); e.stopImmediatePropagation(); location.hash = '#/' + map[e.key]; gPending = 0; }
  }
}, true);
$('#helpBtn').addEventListener('click', () => $('#help').showModal());

fill($('#topTarget'), '#1 to beat ', h('b', {}, fmtRun(RECORD.time)), ` · ${RECORD.runner}`);
initPWA($('#installSlot'));
// Voice: 🔊 reads the page that is open; 🗣 opens voice settings (Breeze TTS 2 on Ganesha, else the browser).
const VOICE_TOGGLES = [['calls', 'Speak split call-outs and pace in the Run navigator and Timer', true], ['claude', 'Speak Claude panel replies', true]];
$('#speakSlot').append(
  voice.readButton(() => $('#view [data-read-main]') || $('#view'), { className: 'iconbtn speak-btn', label: 'Read this page aloud' }),
  h('button', { class: 'iconbtn', id: 'voiceBtn', title: 'Voice settings', 'aria-label': 'Voice settings', onclick: () => { fill($('#voicePanel'), voice.settingsPanel({ toggles: VOICE_TOGGLES })); $('#voice').showModal(); } }, '🗣'));
initPalette($('#palBtn'));
initBridge($('#installSlot'));
patches.subscribe((d, fresh) => {
  const b = $('#patchBadge');
  b.textContent = fresh.length; b.classList.toggle('hidden', !fresh.length);
});
patches.start();
window.addEventListener('hashchange', route);
route();
