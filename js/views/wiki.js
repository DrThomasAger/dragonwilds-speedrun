// Mechanics wiki — sourced entries, cross-linked to route skips, requirements,
// clips and the live patch notes that mention them.
import { h, isTyping, fill } from '../lib/util.js';
import { ROUTE, REQUIREMENTS, TECH } from '../data/route.js';
import { SPLITS } from '../data/raid.js';
import * as patches from '../lib/patches.js';

export const title = 'Mechanics wiki';
export const keys = [['/', 'Search'], ['j / k', 'Next / previous entry']];

export async function mount(root, { params }) {
  let W = [], ENGINE = null;
  try { ({ WIKI: W, ENGINE } = await import('../data/wiki.js')); } catch { /* not built yet */ }
  if (!W.length) { root.append(h('div', { class: 'empty' }, 'The wiki data is not available yet.')); return; }
  const byId = Object.fromEntries(W.map(e => [e.id, e]));
  let cur = byId[params.id] || W[0], q = '';
  const layout = h('div', { class: 'wiki' + (params.id ? ' reading' : '') });
  const index = h('nav', { class: 'wiki-index', 'aria-label': 'Wiki entries' });
  const page = h('article', { class: 'wiki-page card' });
  const search = h('input', { type: 'search', placeholder: `Search ${W.length} entries…`, 'aria-label': 'Search wiki', oninput: () => { q = search.value.toLowerCase(); paintIndex(); } });
  layout.append(h('div', {}, search, index), page);
  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Mechanics wiki'),
    h('p', {}, 'How the movement kit, spells, stamina, raid zones and engine behave — each fact with its source, each entry linked to the skips that use it and the patch notes that touched it.'),
    ENGINE ? h('p', { class: 'note' }, `Engine: ${ENGINE.name}${ENGINE.version ? ' ' + ENGINE.version : ''}.`) : null)), layout);

  const cats = [...new Set(W.map(e => e.cat))];
  function paintIndex() {
    const hits = W.filter(e => !q || `${e.title} ${e.summary} ${(e.facts || []).flat().join(' ')} ${(e.speedrun || []).join(' ')}`.toLowerCase().includes(q));
    fill(index, ...cats.flatMap(c => {
      const es = hits.filter(e => e.cat === c);
      return es.length ? [h('div', { class: 'cat' }, c), ...es.map(e => h('a', { href: `#/wiki?id=${e.id}&keep=1`, class: e === cur ? 'on' : '', onclick: ev => { ev.preventDefault(); open(e); } }, e.title))] : [];
    }));
    if (!hits.length) index.append(h('div', { class: 'note' }, 'No matches.'));
  }
  function usedBy(e) {
    const t = e.title.toLowerCase(), id = e.id;
    const reqs = REQUIREMENTS.filter(r => r.wiki === id);
    const skips = [];
    ROUTE.forEach((sp, k) => sp.skips.forEach(s => { if (reqs.some(r => r.used.includes(s.id) || r.used.includes('*')) || `${s.name} ${(s.how || []).join(' ')} ${s.text || ''}`.toLowerCase().includes(t)) skips.push({ s, k }); }));
    TECH.forEach(s => { if (reqs.some(r => r.used.includes(s.id)) || `${s.name} ${s.how.join(' ')}`.toLowerCase().includes(t)) skips.push({ s, k: null }); });
    return { reqs, skips };
  }
  function patchMentions(e) {
    const d = patches.get();
    if (!d) return [];
    const words = [e.title.toLowerCase(), ...(e.aliases || []).map(a => a.toLowerCase())];
    const out = [];
    for (const p of d.posts) for (const l of p.lines) if (words.some(w => l.text.toLowerCase().includes(w))) out.push({ p, l });
    return out.slice(0, 12);
  }
  function paintPage() {
    const { reqs, skips } = usedBy(cur);
    const pm = patchMentions(cur);
    fill(page, 
      h('button', { class: 'btn sm back', onclick: () => { layout.classList.remove('reading'); } }, '‹ All entries'),
      h('div', { class: 'note' }, cur.cat), h('h1', {}, cur.title), h('p', {}, cur.summary),
      cur.facts && cur.facts.length ? h('div', { class: 'facts' }, cur.facts.map(([k, v]) => h('div', {}, k, h('b', {}, v)))) : null,
      reqs.length ? h('div', { class: 'callout info' }, h('b', {}, 'Raid requirement: '), reqs.map(r => `${r.name} — ${r.need}`).join(' · ')) : null,
      cur.speedrun && cur.speedrun.length ? [h('h3', {}, 'For speedrunning'), h('ul', {}, cur.speedrun.map(x => h('li', {}, x)))] : null,
      skips.length ? [h('h3', {}, 'Used in the route'), h('div', { class: 'chips' }, skips.map(({ s, k }) => h('a', { class: 'chip', href: `#/practice?skip=${s.id}` }, s.name, h('small', {}, k == null ? 'tech' : SPLITS[k].short))))] : null,
      cur.patches && cur.patches.length ? [h('h3', {}, 'Patch history'), h('ul', {}, cur.patches.map(([v, t]) => h('li', {}, h('b', {}, v), ' — ', t)))] : null,
      pm.length ? [h('h3', {}, 'In the official patch notes'), h('ul', { class: 'plines' }, pm.map(({ p, l }) => h('li', { class: l.raid ? 'raid' : l.move ? 'move' : '' }, h('a', { href: p.url, target: '_blank', rel: 'noopener', class: 'mono note' }, p.version || p.date), ' ', l.text)))] : null,
      cur.related && cur.related.length ? [h('h3', {}, 'Related'), h('div', { class: 'chips' }, cur.related.filter(id => byId[id]).map(id => h('button', { class: 'chip', onclick: () => open(byId[id]) }, byId[id].title)))] : null,
      cur.sources && cur.sources.length ? h('details', { style: { marginTop: '14px' } }, h('summary', { class: 'note' }, `Sources (${cur.sources.length})`), h('ul', {}, cur.sources.map(u => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, u.replace(/^https?:\/\//, '')))))) : null);
  }
  function open(e) {
    cur = e; layout.classList.add('reading');
    history.replaceState(null, '', `#/wiki?id=${e.id}&keep=1`);
    paintIndex(); paintPage();
    if (matchMedia('(max-width: 719px)').matches) window.scrollTo(0, 0);
  }
  const unsub = patches.subscribe(() => paintPage());
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key === 'j' || e.key === 'k') { const i = W.indexOf(cur) + (e.key === 'j' ? 1 : -1); if (W[i]) open(W[i]); }
  };
  document.addEventListener('keydown', onKey);
  paintIndex(); paintPage();
  return () => { unsub(); document.removeEventListener('keydown', onKey); };
}
