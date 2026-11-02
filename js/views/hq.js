// HQ — what it takes to be #1, with live leaderboard and the gap analysis.
import { h, fmtRun, fmtDelta } from '../lib/util.js';
import { SPLITS, RUNS, RUN, RULES, PATCHES, COLORS, SRC, communityBest } from '../data/raid.js';
import { BY_KEY } from '../data/videos.js';
import { leaderboard } from '../lib/src.js';
import { model } from '../lib/sync.js';
import { sumOfBest } from '../lib/timer.js';
import { ytUrl } from '../lib/player.js';
import { OPPORTUNITIES } from '../data/route.js';
import * as store from '../lib/store.js';

export const title = 'HQ';

export function mount(root) {
  const st = store.get();
  const allModels = RUNS.map(r => model(r, st.runs[r.key]));
  const models = allModels.slice(0, 3);
  const cb = communityBest(allModels);
  const csob = cb.reduce((a, b) => a + b.seg, 0);
  const wr = models[0];
  const pb = st.timer.pb, mySob = sumOfBest(st.timer.best);

  const target = h('div', { class: 'target-card' },
    h('div', { class: 'kicker' }, 'Raid · Scorned Wilderness · 1.0.0.6+ · #1 to beat'),
    h('div', { class: 'wr', id: 'wrTime' }, fmtRun(wr.time, 2)),
    h('div', { class: 'sub', id: 'wrWho' }, 'TexasPete · 14 Oct 2026 · verified on speedrun.com'),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', { class: 'gold' }, fmtRun(csob, 1)), h('span', {}, 'Community sum of best — fastest segment from any record')),
      h('div', { class: 'stat' }, h('b', {}, pb ? fmtRun(pb.time, 2) : '—'), h('span', {}, pb ? `Your PB · ${fmtDelta(pb.time - wr.time)} vs #1` : 'Your PB — run the timer or import LiveSplit')),
      h('div', { class: 'stat' }, h('b', {}, mySob ? fmtRun(mySob, 1) : '—'), h('span', {}, mySob ? `Your sum of best · ${fmtDelta(mySob - wr.time)} vs #1` : 'Your sum of best'))));

  const actions = h('div', { class: 'actions' },
    action('#/compare', 'Race the WR', 'TexasPete 6:50 vs Nanobit 7:01, synced to the run timer — add your own run.'),
    action('#/studio?id=p-sob', `Watch the ${fmtRun(csob, 0)} composite`, 'Best segment from every record, cut together with no gaps.'),
    action('#/route', 'Current route', 'Every skip on 1.0.1.2, split by split, with the clip for each.'),
    action('#/practice', 'Drill skips', 'Loop a skip, log made / missed, see your consistency.'),
    action('#/timer', 'Split timer + LiveSplit', 'Export a .lss with the WR as a comparison.'),
    action('#/compare?mode=split', 'Split-aligned study', 'Every run starts each segment together.'));

  // Where the time is: segment bars per record + community best.
  const maxSeg = Math.max(...SPLITS.map((_, k) => Math.max(...models.map(m => m.segs[k]))));
  const segTable = h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Split'), ...models.map((m, i) => h('th', { class: 'num' }, h('span', { class: 'dot', style: { '--c': COLORS[i] } }), ' ', m.label.replace(/ \(WR\)/, ''))), h('th', { class: 'num' }, 'Best'), h('th', { class: 'num' }, 'You'))),
    h('tbody', {}, SPLITS.map((s, k) => h('tr', {},
      h('td', {}, h('a', { href: `#/compare?mode=split&seg=${k}` }, `${k + 1}. ${s.name}`)),
      ...models.map(m => h('td', { class: 'num ' + (m.key === cb[k].run ? 'gold' : '') }, fmtRun(m.segs[k], 1))),
      h('td', { class: 'num gold', title: cb[k].runner }, fmtRun(cb[k].seg, 1)),
      h('td', { class: 'num' }, st.timer.best[k] != null ? fmtRun(st.timer.best[k], 1) : '—')))));
  const bars = h('div', { class: 'bars', style: { marginTop: '12px' } }, SPLITS.map((s, k) => h('div', {},
    h('div', { class: 'note' }, `${k + 1}. ${s.name}`),
    ...models.map((m, i) => h('div', { class: 'b' }, h('span', { class: 'note' }, m.runner + (m.key === 'tp740' ? ' 7:40' : '')), h('div', {}, h('i', { style: { width: (100 * m.segs[k] / maxSeg) + '%', '--c': COLORS[i] } })), h('span', { class: 'num' }, fmtRun(m.segs[k], 1)))))));

  const board = h('div', { class: 'card' }, h('h2', {}, 'Leaderboard (live)'), h('div', { class: 'empty' }, 'Loading speedrun.com…'));
  const opp = h('div', { class: 'card' }, h('h2', {}, 'Where #1 is won'), h('div', { class: 'feed' }, OPPORTUNITIES.map(o => h('div', { class: 'callout ' + (o.kind || '') },
    h('b', {}, o.title), h('div', { class: 'note', style: { marginTop: '4px', color: 'var(--ink)' } }, o.text),
    o.src ? h('div', { class: 'row tight', style: { marginTop: '6px' } }, o.src.map(k => { const v = BY_KEY[k]; return v ? h('a', { class: 'pill', href: ytUrl(v.id), target: '_blank', rel: 'noopener' }, '↗ ', v.author) : null; }), o.go ? h('a', { class: 'btn xs', href: o.go[0] }, o.go[1]) : null) : null))));
  const patches = h('div', { class: 'card' }, h('h2', {}, 'Patch timeline'), h('div', { class: 'feed' }, [...PATCHES].reverse().map(p => h('div', { class: 'item' }, h('time', {}, p.v, h('br'), p.date.slice(5)), h('div', {}, p.text, ' ', (p.src || []).map(k => BY_KEY[k] ? h('a', { href: ytUrl(BY_KEY[k].id), target: '_blank', rel: 'noopener', class: 'note' }, ` ↗${BY_KEY[k].author}`) : null))))));
  const rules = h('div', { class: 'card' }, h('h2', {}, 'Timing rules'), h('p', { class: 'note' }, h('b', {}, 'Start: '), RULES.start), h('p', { class: 'note' }, h('b', {}, 'End: '), RULES.end), h('p', { class: 'note' }, RULES.video, ' ', h('a', { href: RULES.link, target: '_blank', rel: 'noopener' }, 'speedrun.com rules ↗')));

  root.append(
    h('div', { class: 'hero' }, target, actions),
    h('div', { class: 'grid g2', style: { marginTop: '16px' } },
      h('div', { class: 'card' }, h('h2', {}, 'Where the record’s time goes'), h('div', { class: 'tablewrap' }, segTable), bars,
        h('p', { class: 'note' }, 'Segment times measured from each runner\'s on-screen LiveSplit. Click a split to watch it in every run side by side.')),
      opp),
    h('div', { class: 'grid g3', style: { marginTop: '16px' } }, board, patches, rules));

  leaderboard().then(d => {
    const top = d.rows[0];
    if (top) { root.querySelector('#wrTime').textContent = fmtRun(top.t, 2); root.querySelector('#wrWho').textContent = `${top.players.join(' & ')} · ${top.date} · speedrun.com ${d.source === 'live' ? '(live)' : d.source === 'cache' ? '(cached)' : '(snapshot)'}`; }
    board.replaceChildren(h('div', { class: 'row' }, h('h2', { style: { margin: 0 } }, 'Leaderboard'), h('span', { class: 'pill ' + (d.source === 'live' ? 'ok' : 'warn') }, d.source), h('span', { class: 'spacer' }), h('a', { class: 'btn xs', href: SRC.board, target: '_blank', rel: 'noopener' }, 'speedrun.com ↗')),
      h('table', { style: { marginTop: '8px' } }, h('tbody', {}, d.rows.slice(0, 10).map(r => h('tr', {},
        h('td', { class: 'num' }, '#' + r.place), h('td', {}, r.players.join(' & ')), h('td', { class: 'num' }, fmtRun(r.t, 2)), h('td', { class: 'note' }, r.date),
        h('td', {}, r.video ? h('a', { href: r.video, target: '_blank', rel: 'noopener' }, '▶') : ''))))),
      h('p', { class: 'note' }, 'Version 1.0.0.6+ bracket (the current game). ', d.error ? `Live fetch failed: ${d.error}.` : ''));
  });
}

function action(href, title, text) { return h('a', { class: 'action', href }, h('b', {}, title), h('span', {}, text)); }
export { RUN };
