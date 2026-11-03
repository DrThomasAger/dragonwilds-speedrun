// Split timer + LiveSplit bridge + attempt analytics.
import { h, fmtRun, fmtDelta, isTyping, toast, download, pickFile, fill } from '../lib/util.js';
import { SplitTimer, recordAttempt, segmentsOf, sumOfBest } from '../lib/timer.js';
import { exportLss, importLss } from '../lib/lss.js';
import { SPLITS, RUNS, RUN, RULES, communityBest, targetPace, TARGET_TIME } from '../data/raid.js';
import { model } from '../lib/sync.js';
import * as store from '../lib/store.js';
import { emit } from '../lib/bridge.js';

export const title = 'Split timer';
export const keys = [['Space / Numpad1', 'Start / split'], ['Backspace / Numpad8', 'Undo split'], ['Numpad2', 'Skip split'], ['R / Numpad3', 'Reset'], ['P / Numpad5', 'Pause']];

const N = SPLITS.length;
const refModel = k => model(RUN[k], store.get().runs[k]);

export function comparisons() {
  const t = store.get().timer;
  const out = [{ id: 'beat650', name: `Beat 6:50 pace (${Math.floor(TARGET_TIME / 60)}:${String((TARGET_TIME % 60).toFixed(0)).padStart(2, '0')})`, splits: targetPace(RUNS.map(r => refModel(r.key))) }];
  if (t.pb) out.push({ id: 'pb', name: 'Personal Best', splits: t.pb.splits });
  const sob = sumOfBest(t.best);
  if (sob) { let acc = 0; out.push({ id: 'sob', name: 'Your sum of best', splits: t.best.map(s => (acc += s)) }); }
  RUNS.forEach(r => { const m = refModel(r.key); out.push({ id: r.key, name: r.label, splits: m.splits }); });
  let acc = 0;
  out.push({ id: 'csob', name: 'Community sum of best', splits: communityBest(RUNS.map(r => refModel(r.key))).map(b => (acc += b.seg)) });
  return out;
}

export function mount(root) {
  const rec = store.get().timer;
  let cmpId = rec.comparison || 'beat650';
  const timer = new SplitTimer(N, { onChange: onTimer });
  let goldSet = new Set();

  const big = h('div', { class: 'timer-big idle', 'aria-live': 'off' }, '0:00.00');
  const segNow = h('div', { class: 'row note' });
  const table = h('table', { class: 'splits' });
  const cmpSel = h('select', { 'aria-label': 'Compare against', onchange: () => { cmpId = cmpSel.value; store.update(s => (s.timer.comparison = cmpId)); paint(); } });
  const btns = h('div', { class: 'row', style: { marginTop: '10px' } },
    h('button', { class: 'btn pri big', onclick: () => timer.split() }, 'Start / Split'),
    h('button', { class: 'btn', onclick: () => timer.undo() }, 'Undo'),
    h('button', { class: 'btn', onclick: () => timer.skip() }, 'Skip'),
    h('button', { class: 'btn', onclick: () => timer.pause() }, 'Pause'),
    h('button', { class: 'btn', onclick: () => reset() }, 'Reset'));
  const stats = h('div', { class: 'card' });
  const history = h('div', { class: 'card' });
  const bridge = h('div', { class: 'card' });

  root.append(h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Split timer'),
    h('p', {}, 'Same splits, rules and comparisons as the community LiveSplit file. Browsers cannot hear hotkeys while the game has focus, so for real attempts export the .lss below into LiveSplit, then import it back here after a session to analyse every attempt.'))),
    h('div', { class: 'split-main' },
      h('div', { class: 'grid' },
        h('div', { class: 'timerbox' }, h('div', { class: 'row' }, h('b', {}, 'Raid — Scorned Wilderness (1.0.0.6+)'), h('span', { class: 'spacer' }), h('label', { class: 'note' }, 'vs ', cmpSel)), table, big, segNow, btns,
          h('p', { class: 'note' }, h('b', {}, 'Start: '), RULES.start, ' ', h('b', {}, 'End: '), RULES.end)),
        history),
      h('div', { class: 'grid' }, stats, bridge)));

  // ---------------------------------------------------------------- paint
  let raf;
  function loop() { paintClock(); raf = requestAnimationFrame(loop); }
  function cmp() { return comparisons().find(c => c.id === cmpId) || comparisons().find(c => c.id === 'tp650'); }
  function paintClock() {
    const t = timer.now();
    big.textContent = fmtRun(t, 2);
    const c = cmp(), k = timer.index;
    let cls = 'timer-big ' + ({ idle: 'idle', done: 'done', paused: 'idle' }[timer.phase] || '');
    if (timer.phase === 'running' && c.splits[k] != null && t > c.splits[k]) cls += ' behind';
    if (timer.phase === 'done' && rec.pb && Math.abs(rec.pb.time - t) < 0.001) cls = 'timer-big pb';
    big.className = cls;
    if (timer.phase === 'running' && k < N) {
      const segStart = k ? timer.splits[k - 1] : 0;
      const live = segStart == null ? null : t - segStart;
      fill(segNow, `Segment ${k + 1}: `, h('b', { class: 'mono' }, fmtRun(live, 1)), ' · best ', h('span', { class: 'mono gold' }, fmtRun(rec.best[k], 1)), ' · ', c.name, ' ', h('span', { class: 'mono' }, fmtRun(c.splits[k] - (k ? c.splits[k - 1] : 0), 1)));
      const row = table.querySelectorAll('tbody tr')[k];
      if (row && c.splits[k] != null) { const d = t - c.splits[k]; const cell = row.querySelector('.delta'); if (d > -10) { cell.textContent = fmtDelta(d); cell.className = 'num delta ' + (d > 0 ? 'behind' : 'ahead'); } }
    } else segNow.textContent = timer.phase === 'idle' ? 'Press Space or Numpad1 to start.' : '';
  }
  function paint() {
    const list = comparisons();
    fill(cmpSel, ...list.map(c => h('option', { value: c.id, selected: c.id === cmpId }, c.name)));
    const c = cmp();
    const segs = segmentsOf(timer.splits);
    fill(table, h('thead', {}, h('tr', {}, h('th', {}, 'Split'), h('th', { class: 'num' }, 'Δ'), h('th', { class: 'num' }, c.name.split(' ')[0]), h('th', { class: 'num' }, 'Time'))),
      h('tbody', {}, SPLITS.map((s, k) => {
        const mine = timer.splits[k];
        const d = mine != null && c.splits[k] != null ? mine - c.splits[k] : null;
        const gold = timer.phase === 'done' ? goldSet.has(k) : segs[k] != null && (rec.best[k] == null || segs[k] < rec.best[k] - 1e-6);
        return h('tr', { class: k === timer.index && timer.phase === 'running' ? 'cur' : '' },
          h('td', {}, s.name),
          h('td', { class: 'num delta ' + (gold ? 'gold' : d == null ? '' : d > 0 ? 'behind' : 'ahead') }, d == null ? '' : fmtDelta(d)),
          h('td', { class: 'num muted' }, fmtRun(c.splits[k], 1)),
          h('td', { class: 'num' }, mine === null && k < timer.index ? '—' : mine != null ? fmtRun(mine, 2) : ''));
      })));
    paintStats(); paintHistory(); paintBridge();
  }
  function paintStats() {
    const sob = sumOfBest(rec.best);
    const cb = communityBest(RUNS.map(r => refModel(r.key)));
    fill(stats, h('h2', {}, 'Where your time is'),
      h('div', { class: 'stats', style: { marginTop: 0 } },
        h('div', { class: 'stat' }, h('b', {}, rec.pb ? fmtRun(rec.pb.time, 2) : '—'), h('span', {}, 'Personal best')),
        h('div', { class: 'stat' }, h('b', {}, sob ? fmtRun(sob, 2) : '—'), h('span', {}, 'Your sum of best')),
        h('div', { class: 'stat' }, h('b', {}, `${rec.runs || 0}/${(rec.runs || 0) + (rec.resets || 0)}`), h('span', {}, 'Finished / attempts'))),
      h('table', { style: { marginTop: '12px' } }, h('thead', {}, h('tr', {}, h('th', {}, 'Segment'), h('th', { class: 'num' }, 'Your best'), h('th', { class: 'num' }, 'Community'), h('th', { class: 'num' }, 'Gap'))),
        h('tbody', {}, SPLITS.map((s, k) => {
          const gap = rec.best[k] != null ? rec.best[k] - cb[k].seg : null;
          return h('tr', {}, h('td', {}, s.short), h('td', { class: 'num gold' }, fmtRun(rec.best[k], 1)), h('td', { class: 'num', title: cb[k].runner }, fmtRun(cb[k].seg, 1)), h('td', { class: 'num ' + (gap > 0 ? 'bad' : 'good') }, gap == null ? '—' : fmtDelta(gap)));
        }))),
      h('p', { class: 'note' }, 'Gap = your gold minus the fastest segment in any reference run. The biggest gap is the split to drill first.'));
  }
  function paintHistory() {
    const at = rec.attempts.slice(-12).reverse();
    const done = rec.attempts.filter(a => a.done).map(a => a.time);
    const reach = SPLITS.map((_, k) => rec.attempts.filter(a => a.splits[k] != null).length);
    fill(history, h('h2', {}, 'Attempts'),
      rec.attempts.length ? h('div', { class: 'bars' }, SPLITS.map((s, k) => h('div', { class: 'b' }, h('span', {}, s.short), h('div', { class: 'meter' }, h('i', { style: { width: (100 * reach[k] / rec.attempts.length) + '%', '--c': 'var(--info)' } })), h('span', { class: 'num' }, `${Math.round(100 * reach[k] / rec.attempts.length)}%`)))) : null,
      rec.attempts.length ? h('p', { class: 'note' }, 'Share of attempts that reached each split — where runs die. ', done.length ? `Median finish ${fmtRun(done.sort((a, b) => a - b)[Math.floor(done.length / 2)], 1)}.` : '') : null,
      at.length ? h('table', {}, h('tbody', {}, at.map(a => h('tr', {}, h('td', { class: 'note' }, new Date(a.at).toLocaleString()), h('td', {}, a.done ? 'finished' : `reset in ${SPLITS[Math.min(a.splits.length, N - 1)].short}`), h('td', { class: 'num' }, a.done ? fmtRun(a.time, 2) : '—'))))) : h('div', { class: 'empty' }, 'No attempts yet. Run the timer or import your LiveSplit file.'),
      rec.attempts.length ? h('button', { class: 'btn sm', style: { marginTop: '10px' }, onclick: () => { if (confirm('Clear all attempts, PB and golds?')) { store.update(s => (s.timer = { ...s.timer, pb: null, best: [], attempts: [], runs: 0, resets: 0 })); Object.assign(rec, store.get().timer); paint(); } } }, 'Clear history') : null);
  }
  function paintBridge() {
    fill(bridge, h('h2', {}, 'LiveSplit'),
      h('p', { class: 'note' }, 'Export: your PB, golds, history, plus every record run and the community sum of best as comparisons — right-click LiveSplit → Compare Against → TexasPete 6:50 (WR).'),
      h('div', { class: 'row' },
        h('button', { class: 'btn pri', onclick: exportFile }, '⬇ Export .lss'),
        h('button', { class: 'btn', onclick: importFile }, '⬆ Import .lss')),
      rec.imported ? h('p', { class: 'note' }, `Last import: ${rec.imported.name}, ${rec.imported.attempts} attempts (${new Date(rec.imported.at).toLocaleDateString()}).`) : null);
  }

  // ---------------------------------------------------------------- actions
  function onTimer(type) {
    if (type === 'split' && timer.splits.length) emit('split', `${SPLITS[timer.index - 1].name} ${fmtRun(timer.splits[timer.index - 1])}`);
    if (type === 'start') emit('run-start', 'Timer started');
    if (type === 'finish') {
      const r = recordAttempt(rec, timer.splits, { done: true });
      goldSet = new Set(r.golds);
      store.update(s => (s.timer = rec));
      emit('finish', `${r.isPB ? 'NEW PB ' : 'Finished '}${fmtRun(timer.splits[N - 1])}`, { splits: timer.splits, golds: r.golds });
      toast(r.isPB ? `New PB ${fmtRun(timer.splits[N - 1])}!` : `Finished ${fmtRun(timer.splits[N - 1])}`, r.isPB ? 'gold' : 'good');
    }
    paint();
  }
  function reset() {
    if (timer.phase === 'running' || timer.phase === 'paused') { if (timer.splits.length) { recordAttempt(rec, timer.splits, { done: false }); store.update(s => (s.timer = rec)); } }
    goldSet = new Set();
    timer.reset();
  }
  function exportFile() {
    const xml = exportLss({ names: SPLITS.map(s => s.name), timer: rec, comparisons: comparisons().filter(c => c.id !== 'pb' && c.id !== 'sob').map(c => ({ name: c.name, splits: c.splits })) });
    download('Runescape Dragonwilds - Raid (Scorned Wilderness).lss', xml, 'application/xml');
  }
  async function importFile() {
    const f = await pickFile('.lss,application/xml,text/xml');
    if (!f) return;
    try {
      const d = importLss(f.text);
      if (d.names.length !== N) toast(`File has ${d.names.length} splits; mapping by order onto ${N}`, 'bad');
      store.update(s => {
        s.timer.pb = d.pb ? { splits: d.pb.splits.slice(0, N), time: d.pb.splits[Math.min(N, d.pb.splits.length) - 1], at: Date.now() } : s.timer.pb;
        s.timer.best = d.best.slice(0, N).map((b, k) => (s.timer.best[k] != null && (b == null || s.timer.best[k] < b) ? s.timer.best[k] : b));
        s.timer.attempts = d.attempts.map(a => ({ ...a, splits: a.splits.slice(0, N) }));
        s.timer.runs = d.attempts.filter(a => a.done).length; s.timer.resets = d.attempts.length - s.timer.runs;
        s.timer.imported = { name: f.name, attempts: d.attempts.length, at: Date.now() };
      });
      Object.assign(rec, store.get().timer);
      toast(`Imported ${d.attempts.length} attempts`, 'good'); paint();
    } catch (e) { toast(e.message || 'Import failed', 'bad'); }
  }
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || document.querySelector('dialog[open]')) return;
    const k = e.code;
    if (k === 'Space' || k === 'Numpad1') { e.preventDefault(); timer.split(); }
    else if (k === 'Backspace' || k === 'Numpad8') { e.preventDefault(); timer.undo(); }
    else if (k === 'Numpad2') timer.skip();
    else if (k === 'KeyR' || k === 'Numpad3') reset();
    else if (k === 'KeyP' || k === 'Numpad5') timer.pause();
  };
  document.addEventListener('keydown', onKey);
  paint(); loop();
  window.__timer = timer;
  return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
}
