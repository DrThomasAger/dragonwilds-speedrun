// Today — the plan for beating 6:50 today, built from the user's own data.
import { h, fmtRun, fmtDelta, fill } from '../lib/util.js';
import { SPLITS, RUNS, RUN, TARGET_TIME, targetPace } from '../data/raid.js';
import { DRILLS } from '../data/route.js';
import { model } from '../lib/sync.js';
import { segmentsOf } from '../lib/timer.js';
import { consistency } from './practice.js';
import * as store from '../lib/store.js';
import * as patches from '../lib/patches.js';

export const title = 'Beat 6:50 today';

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function mount(root) {
  const st = store.get();
  const models = RUNS.map(r => model(r, st.runs[r.key]));
  const target = targetPace(models);
  const tSegs = segmentsOf(target);
  const rec = st.timer;
  const today = rec.attempts.filter(a => a.at >= startOfDay());
  const doneToday = today.filter(a => a.done);
  const bestToday = doneToday.length ? Math.min(...doneToday.map(a => a.time)) : null;
  const seg = st.segPractice || {};

  // 1. weakest skips first
  const drills = DRILLS().map(d => ({ d, c: consistency((st.practice[d.id] || {}).log) }))
    .sort((a, b) => (a.c.n ? a.c.score : 0.5) - (b.c.n ? b.c.score : 0.5)).slice(0, 4);

  const status = (mine, goal) => mine == null ? h('span', { class: 'pill' }, 'no time yet') : mine <= goal ? h('span', { class: 'pill ok' }, `on pace ${fmtDelta(mine - goal)}`) : h('span', { class: 'pill dead' }, `${fmtDelta(mine - goal)} to find`);

  root.append(
    h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Beat 6:50 today'),
      h('p', {}, `The record is 6:50.00 (TexasPete), set with tricks that have since been patched. Using only pieces that still work on 1.0.1.2, the best run anyone has shown adds up to 6:52.8, so the record needs a cleaner Sanctum flight and a first-try heart. Target pace: ${fmtRun(TARGET_TIME, 1)}, measured skip by skip. Work down the four steps.`))),
    h('div', { class: 'grid g4', style: { marginBottom: '16px' } },
      stat(fmtRun(410, 2), 'Record to beat'), stat(fmtRun(TARGET_TIME, 2), 'Target pace', 'gold'),
      stat(bestToday ? fmtRun(bestToday, 2) : '—', `Best today (${doneToday.length} finished / ${today.length} tries)`, bestToday && bestToday < 410 ? 'good' : ''),
      stat(rec.pb ? fmtRun(rec.pb.time, 2) : '—', rec.pb ? `PB · ${fmtDelta(rec.pb.time - 410)} vs record` : 'Personal best')),

    h('section', { class: 'card', style: { marginBottom: '14px' } },
      h('h2', {}, '1 · Warm up on your weakest skips'),
      h('p', { class: 'note' }, 'Ten clean attempts each, logged with J / K. These are the skips you have made least often.'),
      h('div', { class: 'grid g2' }, drills.map(({ d, c }) => h('a', { class: 'drill', href: `#/practice?skip=${d.id}`, style: { color: 'var(--ink)', textDecoration: 'none' } },
        h('div', {}, h('div', { class: 'name' }, d.name), h('div', { class: 'meta' }, c.n ? `${Math.round(100 * c.rate)}% of last ${c.recent}` : 'not drilled yet')),
        h('span', { class: 'pill warn' }, d.split != null ? SPLITS[d.split].short : 'tech'))))),

    h('section', { class: 'card', style: { marginBottom: '14px' } },
      h('h2', {}, '2 · Hit the pace on each split'),
      h('p', { class: 'note' }, 'Time each split on its own until your best is at or under the target.'),
      h('div', { class: 'tablewrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Split'), h('th', { class: 'num' }, 'Target'), h('th', { class: 'num' }, 'Record'), h('th', { class: 'num' }, 'Your best'), h('th', {}, ''), h('th', {}, ''))),
        h('tbody', {}, SPLITS.map((s, k) => {
          const practiced = (seg[k] || []).map(x => x.t);
          const mine = [rec.best[k], ...practiced].filter(x => x != null);
          const best = mine.length ? Math.min(...mine) : null;
          const wr = models[0].segs[k];
          return h('tr', {}, h('td', {}, `${k + 1}. ${s.name}`), h('td', { class: 'num gold' }, fmtRun(tSegs[k], 1)), h('td', { class: 'num muted' }, fmtRun(wr, 1)),
            h('td', { class: 'num' }, fmtRun(best, 1)), h('td', {}, status(best, tSegs[k])),
            h('td', {}, h('a', { class: 'btn xs', href: '#/run' }, 'Practise')));
        }))))),

    h('section', { class: 'card', style: { marginBottom: '14px' } },
      h('h2', {}, '3 · Full attempts'),
      h('p', { class: 'note' }, 'Open the Run navigator on your second screen. It races you against the target pace and tells you, at every split, how much time you have to find.'),
      h('div', { class: 'row' }, h('a', { class: 'btn pri big', href: '#/run' }, '▶ Start an attempt'), h('a', { class: 'btn', href: '#/compare?mode=split' }, 'Study the records split-aligned'), h('a', { class: 'btn', href: '#/studio?id=p-sob' }, 'Watch the 6:38 composite')),
      today.length ? h('div', { class: 'tablewrap', style: { marginTop: '10px' } }, h('table', {}, h('tbody', {}, today.slice().reverse().map(a => h('tr', {},
        h('td', { class: 'note' }, new Date(a.at).toLocaleTimeString()),
        h('td', {}, a.done ? `finished ${fmtRun(a.time, 2)}` : `reset in ${SPLITS[Math.min(a.splits.length, 4)].short}`),
        h('td', { class: 'num ' + (a.done && a.time < 410 ? 'good' : 'bad') }, a.done ? fmtDelta(a.time - 410) : '')))))) : null),

    h('section', { class: 'card' },
      h('h2', {}, '4 · Know before you go'),
      h('div', { id: 'todayIntel' }, h('p', { class: 'note' }, 'Checking patch notes and new runs…'))));

  // live intel: latest patch + newest sources (hourly mirror)
  const intel = root.querySelector('#todayIntel');
  const paint = async () => {
    const lp = patches.latestPatch();
    let src = null;
    try { src = await (await fetch('https://raw.githubusercontent.com/DrThomasAger/dragonwilds-speedrun/main/data/sources.json?t=' + Date.now())).json(); }
    catch { try { src = await (await fetch('data/sources.json')).json(); } catch { /* none */ } }
    if (!root.isConnected) return;
    const items = src ? Object.values(src.items) : [];
    // YouTube gives relative ages ("10 days ago"); keep the last two weeks, newest first.
    const age = p => { const m = /(\d+)\s*(mo|y|w|d|h|min|m|s)/.exec(p || ''); if (!m) return 1e9; return +m[1] * { mo: 30, y: 365, w: 7, d: 1, h: 1 / 24, min: 1 / 1440, m: 1 / 1440, s: 1 / 86400 }[m[2]]; };
    const fresh = items.filter(i => i.kind === 'video' && age(i.published) <= 14).sort((a, b) => age(a.published) - age(b.published)).slice(0, 6);
    const beat = items.filter(i => i.beatsRecord);
    fill(intel,
      lp ? h('p', {}, h('b', {}, `Patch ${lp.version}`), ` (${lp.date}). `, patches.cmpVersion(lp.version, patches.ROUTE_VERIFIED_ON) > 0 ? h('span', { class: 'bad' }, 'Newer than the route — check skips first.') : h('span', { class: 'good' }, 'Route verified on this patch.')) : null,
      beat.length ? h('div', { class: 'callout' }, h('b', {}, 'Someone may have beaten 6:50: '), beat.map(b => h('a', { href: b.url, target: '_blank', rel: 'noopener' }, b.title)).reduce((a, x) => (a.length ? [...a, ', ', x] : [x]), [])) : h('p', { class: 'good' }, 'No current-patch run under 6:50 yet. The record is still there to take.'),
      src ? h('p', { class: 'note' }, `Sources checked ${new Date(src.checkedAt).toLocaleString()}: ${src.counts.verified} verified runs, ${src.counts.pending} awaiting verification, ${src.counts.videos} raid videos.`) : null,
      fresh.length ? h('div', {}, h('div', { class: 'note' }, 'Raid videos from the last two weeks'), h('ul', {}, fresh.map(v => h('li', {}, h('a', { href: v.url, target: '_blank', rel: 'noopener' }, v.title), h('span', { class: 'note' }, ` · ${v.author} · ${v.published}`))))) : null,
      h('p', { class: 'note' }, 'Unconfirmed on 1.0.1.2: the Kuldra fight skip and the Sanctum flight. Test them in practice before a full attempt.'));
  };
  const unsub = patches.subscribe(() => paint());
  paint();
  return unsub;
}

function stat(v, label, cls = '') { return h('div', { class: 'stat' }, h('b', { class: cls }, v), h('span', {}, label)); }
export { RUN };
