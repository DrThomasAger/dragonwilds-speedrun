// Practice — drill one skip at a time against its reference clip and track consistency.
import { h, fmtRun, isTyping, toast, fill } from '../lib/util.js';
import { reelPlayer } from '../lib/ui.js';
import { ROUTE, DRILLS } from '../data/route.js';
import { SPLITS } from '../data/raid.js';
import * as store from '../lib/store.js';
import { emit } from '../lib/bridge.js';

export const title = 'Practice';
export const keys = [['J', 'Made it'], ['K', 'Missed it'], ['U', 'Undo last'], ['N', 'Next suggested drill'], ['Space', 'Play / pause reference'], ['L', 'Loop reference']];

// Laplace-smoothed success rate over the last 20 attempts.
export function consistency(log = []) {
  const last = log.slice(-20);
  const ok = last.filter(x => x.ok).length;
  return { n: log.length, recent: last.length, rate: last.length ? ok / last.length : null, score: (ok + 1) / (last.length + 2), streak: (() => { let s = 0; for (let i = log.length - 1; i >= 0 && log[i].ok; i--) s++; return s; })() };
}

export function mount(root, { params }) {
  const prac = store.get().practice;
  const drills = DRILLS();
  let cur = drills.find(d => d.id === params.skip) || suggest();
  const session = { ok: 0, miss: 0 };

  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Practice'),
    h('p', {}, 'Pick a skip, loop the reference until the inputs make sense, then go try it in-game and log each attempt with J (made) or K (missed). The list sorts itself so your least consistent skip is always on top.'))));
  const layout = h('div', { class: 'split-main' });
  const left = h('div'), right = h('div', { class: 'card' });
  layout.append(left, right); root.append(layout);
  const P = reelPlayer(left);
  const panel = h('div', { class: 'card', style: { marginTop: '14px' } });
  left.append(panel);

  function suggest() {
    const scored = drills.map(d => ({ d, c: consistency((prac[d.id] || {}).log) }));
    const fresh = scored.filter(x => x.c.n === 0);
    const tried = scored.filter(x => x.c.n > 0).sort((a, b) => a.c.score - b.c.score);
    return (tried.length && tried[0].c.score < 0.8 ? tried[0] : fresh[0] || tried[0] || scored[0]).d;
  }
  function select(d, play = true) {
    cur = d; paintList(); paintPanel();
    if (play && d.clips.length) { P.play(d.clips, { name: d.name }); if (!P.reel.loopClip && d.clips.length === 1) P.card.querySelector('.transport button[title^="Loop the current"]').click(); }
  }
  function log(ok) {
    store.update(s => { (s.practice[cur.id] ||= { log: [] }).log.push({ t: Date.now(), ok }); });
    session[ok ? 'ok' : 'miss']++;
    const c = consistency(prac[cur.id].log);
    emit('practice', `${ok ? 'Made' : 'Missed'} ${cur.name} (${Math.round(100 * c.rate)}% of last ${c.recent})`);
    toast(`${ok ? '✓ Made' : '✗ Missed'} — ${Math.round(100 * c.rate)}% of last ${c.recent}`, ok ? 'good' : 'bad');
    paintList(); paintPanel();
  }
  function undo() { const l = (prac[cur.id] || {}).log; if (!l || !l.length) return; const x = l.pop(); session[x.ok ? 'ok' : 'miss']--; store.update(() => {}); paintList(); paintPanel(); }

  function paintPanel() {
    const c = consistency((prac[cur.id] || {}).log);
    const last = ((prac[cur.id] || {}).log || []).slice(-30);
    fill(panel, 
      h('div', { class: 'row' }, h('h2', { style: { margin: 0 } }, cur.name), cur.split != null ? h('span', { class: 'pill' }, `Split ${cur.split + 1} · ${SPLITS[cur.split].short}`) : h('span', { class: 'pill new' }, 'movement tech'),
        cur.status ? h('span', { class: 'pill ' + ({ works: 'ok', new: 'new', patched: 'dead', check: 'warn' }[cur.status] || '') }, cur.status) : null),
      cur.how && cur.how.length ? h('ol', {}, cur.how.map(x => h('li', {}, x))) : cur.text ? h('p', {}, cur.text) : h('p', { class: 'note' }, 'Watch the reference clip for the line, then try it in game.'),
      h('div', { class: 'row', style: { margin: '14px 0 8px' } },
        h('button', { class: 'btn pri big', style: { background: 'var(--good)', borderColor: 'var(--good)' }, onclick: () => log(true) }, '✓ Made it  ', h('kbd', {}, 'J')),
        h('button', { class: 'btn big', style: { background: 'var(--bad-soft, #3a1c1a)', borderColor: 'var(--bad)' }, onclick: () => log(false) }, '✗ Missed  ', h('kbd', {}, 'K')),
        h('button', { class: 'btn', onclick: undo }, 'Undo ', h('kbd', {}, 'U'))),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', { class: c.rate == null ? '' : c.rate >= 0.8 ? 'good' : c.rate >= 0.5 ? 'gold' : 'bad' }, c.rate == null ? '—' : Math.round(100 * c.rate) + '%'), h('span', {}, `last ${c.recent || 20} attempts`)),
        h('div', { class: 'stat' }, h('b', {}, c.n), h('span', {}, 'attempts logged')),
        h('div', { class: 'stat' }, h('b', {}, c.streak), h('span', {}, 'current streak'))),
      last.length ? h('div', { style: { marginTop: '10px' } }, h('span', { class: 'spark', title: 'Last 30 attempts' }, last.map(x => h('i', { class: x.ok ? '' : 'x' })))) : null,
      h('p', { class: 'note' }, `This session: ${session.ok} made, ${session.miss} missed.`, cur.credit ? ` Credit: ${cur.credit}.` : ''));
  }
  function paintList() {
    const scored = drills.map(d => ({ d, c: consistency((prac[d.id] || {}).log) }));
    const groups = [...SPLITS.map((s, k) => [`${k + 1}. ${s.name}`, scored.filter(x => x.d.split === k)]), ['Movement tech', scored.filter(x => x.d.split == null)]];
    const sug = suggest();
    fill(right, h('div', { class: 'row' }, h('h2', { style: { margin: 0 } }, 'Drills'), h('span', { class: 'spacer' }), h('button', { class: 'btn sm', onclick: () => select(suggest()) }, 'Next suggested ', h('kbd', {}, 'N'))),
      ...groups.filter(g => g[1].length).map(([name, items]) => h('div', { style: { marginTop: '12px' } }, h('div', { class: 'note' }, name),
        h('div', { class: 'grid', style: { gap: '6px', marginTop: '4px' } }, items.map(({ d, c }) => h('div', { class: 'drill' + (d === cur ? ' cur' : ''), role: 'button', tabindex: 0, onclick: () => select(d), onkeydown: e => e.key === 'Enter' && select(d) },
          h('div', {}, h('div', { class: 'name' }, d.name, d === sug ? h('span', { class: 'pill warn', style: { marginLeft: '6px' } }, 'next') : null),
            h('div', { class: 'meta' }, c.n ? `${Math.round(100 * c.rate)}% of last ${c.recent} · ${c.n} total` : 'not drilled yet'),
            c.n ? h('div', { class: 'meter', style: { marginTop: '4px' } }, h('i', { style: { width: (100 * c.rate) + '%', '--c': c.rate >= 0.8 ? 'var(--good)' : c.rate >= 0.5 ? 'var(--gold)' : 'var(--bad)' } })) : null),
          d.status ? h('span', { class: 'pill ' + ({ works: 'ok', new: 'new', patched: 'dead', check: 'warn' }[d.status] || '') }, d.status) : null))))));
  }
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'j' || e.key === 'J') log(true);
    else if (e.key === 'k' || e.key === 'K') log(false);
    else if (e.key === 'u' || e.key === 'U') undo();
    else if (e.key === 'n' || e.key === 'N') select(suggest());
    else P.clips.length && P.key(e);
  };
  document.addEventListener('keydown', onKey);
  select(cur, false);
  if (cur.clips.length) P.play(cur.clips, { name: cur.name, autoplay: false });
  return () => { document.removeEventListener('keydown', onKey); P.destroy(); };
}
export { ROUTE, fmtRun };
