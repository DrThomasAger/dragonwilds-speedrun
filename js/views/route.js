// Route — the current-patch raid route, split by split, every skip with its clips.
import { h, fmtRun, isTyping } from '../lib/util.js';
import { reelPlayer, videoChip } from '../lib/ui.js';
import { ROUTE, GEAR, REQUIREMENTS } from '../data/route.js';
import { PHASES } from '../data/hardcore.js';
import { SPLITS, RUNS, COLORS, communityBest } from '../data/raid.js';
import { model } from '../lib/sync.js';
import * as store from '../lib/store.js';

export const title = 'Route';
export const keys = [['Space', 'Play / pause'], ['[ ]', 'Previous / next clip'], ['L', 'Loop clip']];

// Requirements timeline: every skill / spell / item / quest, grouped by the
// Hardcore phase that unlocks it, with a "have it" tick saved per browser.
export function requirementsCard() {
  const have = store.get().prefs.have || {};
  const count = h('span', { class: 'pill' });
  const paintCount = () => { const n = REQUIREMENTS.filter(r => have[r.id]).length; count.textContent = `${n}/${REQUIREMENTS.length} ready`; count.className = 'pill ' + (n === REQUIREMENTS.length ? 'ok' : 'warn'); };
  const groups = PHASES.filter(p => REQUIREMENTS.some(r => r.phase === p.id)).map(p => h('div', { class: 'reqgroup' },
    h('a', { class: 'note', href: '#/hardcore' }, p.title.replace(/ — .*/, ''), ' · ', p.title.split(' — ')[1] || ''),
    REQUIREMENTS.filter(r => r.phase === p.id).map(r => h('label', { class: 'req' + (have[r.id] ? ' ok' : '') },
      h('input', { type: 'checkbox', checked: !!have[r.id], 'aria-label': 'I have ' + r.name, onchange: e => { have[r.id] = e.target.checked; e.target.closest('label').classList.toggle('ok', e.target.checked); store.update(s => (s.prefs.have = have)); paintCount(); } }),
      h('span', {}, h('b', {}, r.name), h('span', { class: 'pill', style: { marginLeft: '6px' } }, r.kind), h('small', {}, r.need, r.note ? ' — ' + r.note : '')),
      h('a', { class: 'btn xs ghost', href: `#/wiki?id=${r.wiki}`, title: 'Wiki' }, '§')))));
  paintCount();
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { style: { margin: 0 } }, 'Requirements timeline'), h('span', { class: 'spacer' }), count),
    h('p', { class: 'note' }, 'Everything the route needs, in the order the Hardcore route unlocks it.'), groups);
}

export function mount(root, { params }) {
  const st = store.get();
  const models = RUNS.map(r => model(r, st.runs[r.key]));
  const cb = communityBest(models);
  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Raid route — patch 1.0.1.2'),
    h('p', {}, 'The five community splits, each with the skips that make it up, how to do them, whether they still work, and the clip that shows it. Segment times are from the record runs.'))));
  const layout = h('div', { class: 'split-main' });
  const left = h('div'), right = h('div', { class: 'grid' });
  layout.append(left, right); root.append(layout);
  const P = reelPlayer(right, { sticky: true });
  right.append(requirementsCard(), h('div', { class: 'card' }, h('h2', {}, 'Bring'), h('ul', { style: { margin: 0, paddingLeft: '18px', fontSize: '13.5px' } }, GEAR.map(([g, why]) => h('li', {}, h('b', {}, g), ' — ', h('span', { class: 'muted' }, why))))));

  ROUTE.forEach((sp, k) => {
    const open = params.split != null ? +params.split === k : k === 0;
    const card = h('section', { class: 'splitcard' + (open ? ' open' : ''), id: 'split-' + k });
    const segClips = models.map(m => ({ vid: m.vid, in: +(m.offset + m.starts[k]).toFixed(2), out: +(m.offset + m.splits[k]).toFixed(2), label: `${m.runner} ${m.key === 'tp740' ? '7:40' : ''} · ${fmtRun(m.segs[k], 1)}`.replace('  ', ' ') }));
    card.append(
      h('header', { onclick: e => { if (!e.target.closest('button,a')) card.classList.toggle('open'); } },
        h('span', { class: 'num' }, k + 1), h('h3', {}, SPLITS[k].name, ' ', h('span', { class: 'pill' }, k === 4 ? 'ends on the cut to black' : 'ends on Extraction point unlocked')),
        h('span', { class: 'note mono' }, 'best ', h('b', { class: 'gold' }, fmtRun(cb[k].seg, 1)), ` (${cb[k].runner})`),
        h('button', { class: 'btn pri sm', onclick: () => { card.classList.add('open'); P.play(segClips, { name: `${SPLITS[k].name} — every record` }); } }, '▶ Watch in every record')),
      h('div', { class: 'body' },
        h('p', {}, sp.summary),
        h('div', { class: 'bars' }, models.map((m, i) => h('div', { class: 'b' }, h('span', { class: 'note' }, m.label), h('div', {}, h('i', { style: { width: (100 * m.segs[k] / Math.max(...models.map(x => x.segs[k]))) + '%', '--c': COLORS[i] } })), h('span', { class: 'num' }, fmtRun(m.segs[k], 1))))),
        h('div', { class: 'row', style: { margin: '8px 0' } },
          h('a', { class: 'btn sm', href: `#/compare?mode=split&seg=${k}` }, '⇆ Side by side, split-aligned'),
          h('a', { class: 'btn sm', href: `#/studio?id=p-seg${k}` }, '✂ Open as reel')),
        ...sp.skips.map(s => h('div', { class: 'skip' },
          h('div', {},
            h('h4', {}, s.name, h('span', { class: 'pill ' + ({ works: 'ok', new: 'new', patched: 'dead', check: 'warn' }[s.status] || '') }, { works: 'works on 1.0.1.x', new: 'new — not in a record yet', patched: 'patched', check: 'unconfirmed' }[s.status] || s.status)),
            s.text ? h('p', {}, s.text) : null,
            s.how && s.how.length ? h('ol', {}, s.how.map(x => h('li', {}, x))) : null,
            s.clips.length ? h('div', { class: 'chips' }, s.clips.map((c, i) => videoChip(c, () => P.play(s.clips, { start: i, name: s.name })))) : null,
            s.credit ? h('p', { class: 'note' }, 'Credit: ', s.credit) : null),
          h('div', { class: 'row tight', style: { alignItems: 'flex-start' } }, h('a', { class: 'btn sm', href: `#/practice?skip=${s.id}` }, '🎯 Drill'))))));
    left.append(card);
  });

  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    P.clips.length && P.key(e);
  };
  document.addEventListener('keydown', onKey);
  if (params.split != null) setTimeout(() => document.getElementById('split-' + params.split)?.scrollIntoView({ block: 'start' }), 50);
  return () => { document.removeEventListener('keydown', onKey); P.destroy(); };
}
