// Hardcore 1 → Max route checklist with clip player (ported from v1).
import { h, isTyping } from '../lib/util.js';
import { reelPlayer, videoChip } from '../lib/ui.js';
import { PHASES } from '../data/hardcore.js';
import * as store from '../lib/store.js';

export const title = 'Hardcore 1→Max';
export const keys = [['Space', 'Play / pause'], ['[ ]', 'Previous / next clip'], ['L', 'Loop clip'], ['D', 'Mark next step done']];

const LEVEL = /\b(Agility|Runecrafting|Attack|Magic|Mining|Woodcutting|Cooking|Construction|Artisan|Fishing|Farming|Ranged|Defence) \d+/g;

export function mount(root) {
  const hc = store.get().hardcore;
  const order = [];
  PHASES.forEach(p => p.segs.forEach((s, si) => s.steps.forEach((st, ti) => order.push({ key: `${p.id}.${si}.${ti}`, p, s, st }))));
  const total = order.length;

  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Hardcore 1 → Max'),
    h('p', {}, 'The full account route that ends at the raid. Tick steps as you go — progress saves in this browser. For the raid itself use the Route and Race the WR pages.'))));
  const layout = h('div', { class: 'hc-layout' });
  const nav = h('nav', { class: 'hc-nav', 'aria-label': 'Phases' });
  const right = h('div');
  layout.append(h('div', {}, h('div', { class: 'prog' }, h('i', { id: 'hcbar' })), h('div', { class: 'note', id: 'hctext' }), nav), right);
  root.append(layout);

  const next = h('div', { class: 'callout good', style: { marginBottom: '14px' } });
  const P = reelPlayer(right, { sticky: true });
  const content = h('div', { style: { marginTop: '14px' } });
  right.prepend(next); right.append(content);

  const nextStep = () => order.find(o => !hc.done[o.key]);
  function save() { store.update(s => (s.hardcore = hc)); }
  function paintProgress() {
    const d = order.filter(o => hc.done[o.key]).length;
    root.querySelector('#hcbar').style.width = (100 * d / total) + '%';
    root.querySelector('#hctext').textContent = `${d} of ${total} steps`;
    const n = nextStep();
    next.replaceChildren(...(n ? [h('div', { class: 'note' }, 'Next step · ', n.p.title.replace(/ — .*/, ''), ' · ', n.s.t), h('div', { class: 'row' }, h('b', { style: { flex: 1 } }, n.st[0]),
      n.s.clips.length ? h('button', { class: 'btn sm', onclick: () => { go(n.p.id); P.play(n.s.clips); } }, '▶ Clip') : null,
      h('button', { class: 'btn pri sm', onclick: () => markNext() }, 'Done ✓'))] : [h('b', {}, 'Every step complete. Go take the raid record.')]));
    nav.replaceChildren(...PHASES.map(p => {
      let n2 = 0, d2 = 0; p.segs.forEach((s, si) => s.steps.forEach((_, ti) => { n2++; if (hc.done[`${p.id}.${si}.${ti}`]) d2++; }));
      return h('button', { class: p.id === hc.phase ? 'on' : '', onclick: () => go(p.id) }, h('span', {}, p.title.replace(/ — .*/, '')), h('small', {}, `${d2}/${n2}`));
    }));
  }
  function go(id) { hc.phase = id; save(); paint(); }
  function markNext() { const n = nextStep(); if (!n) return; hc.done[n.key] = true; if (hc.phase !== n.p.id) hc.phase = n.p.id; save(); paint(); }
  function paint() {
    paintProgress();
    const p = PHASES.find(x => x.id === hc.phase) || PHASES[0];
    const n = nextStep();
    content.replaceChildren(
      h('div', { class: 'card', style: { marginBottom: '14px' } }, h('h2', { style: { fontFamily: 'var(--serif)', fontSize: '22px' } }, p.title), h('p', { class: 'muted' }, p.sub), h('p', {}, p.intro),
        h('div', { class: 'kv' }, p.kv.map(([k, v]) => h('div', {}, k, h('b', {}, v))))),
      ...p.segs.map((s, si) => {
        const open = (n && n.p.id === p.id && n.s === s) || (!(n && n.p.id === p.id) && si === 0);
        const card = h('section', { class: 'splitcard' + (open ? ' open' : '') });
        card.append(h('header', { onclick: e => { if (!e.target.closest('button')) card.classList.toggle('open'); } },
          h('span', { class: 'num' }, `${si + 1}`), h('h3', {}, s.t), h('span', { class: 'note' }, `${s.steps.length} steps · ${s.clips.length} clip${s.clips.length === 1 ? '' : 's'}`),
          s.clips.length ? h('button', { class: 'btn pri sm', onclick: () => { card.classList.add('open'); P.play(s.clips, { name: s.t }); } }, '▶ Play all') : null),
          h('div', { class: 'body' },
            h('div', { class: 'callout info', style: { margin: '8px 0' } }, s.why),
            s.clips.length ? h('div', { class: 'chips' }, s.clips.map((c, i) => videoChip(c, () => P.play(s.clips, { start: i, name: s.t })))) : null,
            s.clips.some(c => c.approx) ? h('p', { class: 'note' }, '≈ marks a range that is an estimate rather than a creator chapter.') : null,
            h('ul', { class: 'steps' }, s.steps.map((st, ti) => {
              const key = `${p.id}.${si}.${ti}`;
              const txt = h('div', { class: 's' + (hc.done[key] ? ' done' : '') }, st[0]);
              const cb = h('input', { type: 'checkbox', checked: !!hc.done[key], 'aria-label': 'Done: ' + st[0], onchange: () => { hc.done[key] = cb.checked; txt.classList.toggle('done', cb.checked); save(); paintProgress(); } });
              const lv = [...new Set((st[0] + ' ' + st[1]).match(LEVEL) || [])].slice(0, 4);
              return h('li', {}, cb, h('div', {}, txt, st[1] ? h('div', { class: 'd' }, st[1]) : null,
                h('div', { class: 'row tight', style: { marginTop: '4px' } },
                  /Hardcore|Hardmode|death|grave/i.test(st[0] + st[1]) ? h('span', { class: 'pill dead' }, 'HARDCORE') : null,
                  lv.map(x => h('span', { class: 'pill warn' }, x)))));
            }))));
        return card;
      }));
  }
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'd' || e.key === 'D') { markNext(); return; }
    P.clips.length && P.key(e);
  };
  document.addEventListener('keydown', onKey);
  paint();
  return () => { document.removeEventListener('keydown', onKey); P.destroy(); };
}
