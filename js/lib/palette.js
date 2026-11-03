// Command palette (Ctrl+K / 🔍): jump to any page, split, skip, wiki entry, video or reel.
import { h, fill } from './util.js';
import { SPLITS } from '../data/raid.js';
import { ROUTE, TECH } from '../data/route.js';
import { VIDEOS } from '../data/videos.js';

let items = null;
async function build() {
  const out = [
    ['Beat 6:50 today', '#/today', 'page'], ['HQ', '#/hq', 'page'], ['Run navigator', '#/run', 'page'], ['Race the WR', '#/compare', 'page'], ['Split-aligned compare', '#/compare?mode=split', 'page'],
    ['Route', '#/route', 'page'], ['Reel Studio', '#/studio', 'page'], ['Practice', '#/practice', 'page'], ['Split timer', '#/timer', 'page'],
    ['Mechanics wiki', '#/wiki', 'page'], ['Patch notes', '#/patches', 'page'], ['Library', '#/library', 'page'], ['Hardcore 1→Max', '#/hardcore', 'page'], ['Hardcore Run mode', 'hardcore-run.html', 'page'],
    ['6:38 community composite reel', '#/studio?id=p-sob', 'reel'],
  ];
  SPLITS.forEach((s, k) => { out.push([`${k + 1}. ${s.name} — route`, `#/route?split=${k}`, 'split'], [`${k + 1}. ${s.name} — every record side by side`, `#/compare?mode=split&seg=${k}`, 'split'], [`${k + 1}. ${s.name} — reel`, `#/studio?id=p-seg${k}`, 'reel']); });
  ROUTE.forEach((sp, k) => sp.skips.forEach(s => out.push([`Drill: ${s.name}`, `#/practice?skip=${s.id}`, SPLITS[k].short])));
  TECH.forEach(s => out.push([`Drill: ${s.name}`, `#/practice?skip=${s.id}`, 'tech']));
  try { const { WIKI } = await import('../data/wiki.js'); WIKI.forEach(e => out.push([`Wiki: ${e.title}`, `#/wiki?id=${e.id}`, e.cat])); } catch { /* none */ }
  VIDEOS.forEach(v => out.push([`${v.author} — ${v.title}`, `#/library?q=${encodeURIComponent(v.author)}`, 'video']));
  return out.map(([label, href, tag]) => ({ label, href, tag, l: label.toLowerCase() }));
}

export function initPalette(button) {
  const input = h('input', { type: 'search', placeholder: 'Jump to a page, split, skip, wiki entry or video…', 'aria-label': 'Search everything' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const dlg = h('dialog', { class: 'palette', 'aria-label': 'Command palette' }, input, list);
  document.body.append(dlg);
  let sel = 0, hits = [];
  const paint = () => {
    const q = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    hits = (items || []).filter(it => q.every(w => it.l.includes(w))).slice(0, 40);
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    fill(list, hits.length ? hits.map((it, i) => h('a', { href: it.href, class: i === sel ? 'on' : '', role: 'option', onclick: () => dlg.close() }, h('span', {}, it.label), h('small', {}, it.tag))) : h('div', { class: 'note', style: { padding: '10px' } }, 'No matches.'));
    const on = list.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' });
  };
  input.addEventListener('input', () => { sel = 0; paint(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); location.href = hits[sel].href; dlg.close(); }
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  const open = async () => { items ||= await build(); input.value = ''; sel = 0; paint(); dlg.showModal(); input.focus(); };
  button.addEventListener('click', open);
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); } });
}
