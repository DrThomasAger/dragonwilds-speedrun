// Library — every verified video, its chapters as playable clips.
import { h, fmtClock, isTyping } from '../lib/util.js';
import { reelPlayer, thumb } from '../lib/ui.js';
import { VIDEOS, KIND_LABEL, chapterClips } from '../data/videos.js';
import { RUNS, SPLITS } from '../data/raid.js';
import { ytUrl } from '../lib/player.js';

export const title = 'Library';
export const keys = [['Space', 'Play / pause'], ['[ ]', 'Previous / next chapter'], ['/', 'Search']];

export function mount(root, { params }) {
  let kind = params.kind || 'all', q = params.q || '';
  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Library'),
    h('p', {}, `${VIDEOS.length} videos, every id, duration and chapter list checked against YouTube on 2 Nov 2026. Play a whole video as a chapter programme, or any single chapter as a clip.`))));
  const layout = h('div', { class: 'split-main lib' });
  const left = h('div'), right = h('div');
  layout.append(left, right); root.append(layout);
  const P = reelPlayer(right, { sticky: true });
  const search = h('input', { type: 'search', placeholder: 'Search title, creator, patch…', value: q, 'aria-label': 'Search videos', style: { flex: 1, minWidth: '200px' }, oninput: () => { q = search.value; paint(); } });
  const tabs = h('div', { class: 'seg-ctl', role: 'group', 'aria-label': 'Filter by kind' });
  const grid = h('div', { class: 'vgrid', style: { marginTop: '12px' } });
  left.append(h('div', { class: 'row' }, search, tabs), grid);

  function paintTabs() {
    tabs.replaceChildren(...[['all', 'All'], ...Object.entries(KIND_LABEL)].map(([k, l]) => h('button', { class: k === kind ? 'on' : '', onclick: () => { kind = k; paint(); } }, l)));
  }
  function paint() {
    paintTabs();
    const ql = q.toLowerCase();
    const vs = VIDEOS.filter(v => (kind === 'all' || v.kind === kind) && (!ql || `${v.title} ${v.author} ${v.patch} ${v.note || ''}`.toLowerCase().includes(ql)));
    grid.replaceChildren(...(vs.length ? vs.map(card) : [h('div', { class: 'empty' }, 'Nothing matches.')]));
  }
  function programme(v) {
    const run = RUNS.find(r => r.vid === v.id);
    if (run) return SPLITS.map((s, k) => ({ vid: v.id, in: run.offset + (k ? run.splits[k - 1] : 0), out: run.offset + run.splits[k], label: `${k + 1}. ${s.name}` }));
    const ch = chapterClips(v);
    return ch.length ? ch : [{ vid: v.id, in: 0, out: v.dur, label: v.title }];
  }
  function card(v) {
    const prog = programme(v);
    return h('article', { class: 'vcard' },
      h('button', { class: 'thumb', style: { backgroundImage: `url(${thumb(v.id)})` }, 'aria-label': 'Play ' + v.title, onclick: () => P.play(prog, { name: v.title }) }, h('span', {}, fmtClock(v.dur))),
      h('div', { class: 'meta' },
        h('b', {}, v.title),
        h('div', { class: 'row tight' }, h('span', { class: 'note' }, v.author), h('span', { class: 'spacer' }),
          h('span', { class: 'pill ' + (v.patched ? 'dead' : /1\.0\.1\.2|1\.0\.1\.x/.test(v.patch) ? 'new' : '') }, v.patched ? `${v.patch} · patched` : v.patch)),
        v.note ? h('div', { class: 'note' }, v.note) : null,
        prog.length > 1 ? h('details', {}, h('summary', {}, `${prog.length} ${RUNS.some(r => r.vid === v.id) ? 'splits' : 'chapters'}`),
          h('div', { class: 'chaps' }, prog.map((c, i) => h('button', { onclick: () => P.play(prog, { start: i, name: v.title }) }, h('small', {}, fmtClock(c.in)), c.label)))) : null,
        h('div', { class: 'row tight' },
          h('button', { class: 'btn sm', onclick: () => P.play(prog, { name: v.title }) }, '▶ Play'),
          h('a', { class: 'btn sm ghost', href: ytUrl(v.id), target: '_blank', rel: 'noopener' }, '↗ YouTube'),
          h('span', { class: 'note' }, v.date))));
  }
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); return; }
    P.clips.length && P.key(e);
  };
  document.addEventListener('keydown', onKey);
  paint();
  return () => { document.removeEventListener('keydown', onKey); P.destroy(); };
}
