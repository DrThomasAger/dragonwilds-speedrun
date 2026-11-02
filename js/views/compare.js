// Race the WR — up to four runs on one run clock, race or split-aligned.
import { h, $, fmtRun, fmtDelta, fmtClock, clamp, isTyping, toast, download, uid, parseTime, fill } from '../lib/util.js';
import { Deck, ytUrl } from '../lib/player.js';
import { SyncGroup, model, progressAt, timeAtProgress } from '../lib/sync.js';
import { scrubber, rateSelect, nudgeRow } from '../lib/ui.js';
import { SPLITS, RUNS, COLORS, communityBest } from '../data/raid.js';
import { BY_ID } from '../data/videos.js';
import * as store from '../lib/store.js';
import { keepAwake } from '../lib/pwa.js';

export const title = 'Race the WR';
export const keys = [['Space', 'Play / pause'], ['← →', '∓ 1 s (Shift: 5 s)'], [', .', '∓ 0.1 s (paused)'], ['[ ]', 'Previous / next split'], ['1–5', 'Jump to split'], ['M', 'Race ↔ split-aligned'], ['S', 'Mark split (marking mode)']];

export const allRuns = () => [...RUNS, ...store.get().customRuns];
export const runModel = r => model(r, store.get().runs[r.key]);

export function mount(root, { params }) {
  const st = store.get();
  let selected = (params.runs ? params.runs.split(',') : st.prefs.compareRuns).filter(k => allRuns().some(r => r.key === k)).slice(0, 4);
  if (!selected.length) selected = ['tp650', 'nano701'];
  let mode = params.mode || st.prefs.compareMode || 'race';
  let group = null, cells = [], editKey = null, marking = null;

  const head = h('div', { class: 'pagehead' },
    h('div', {}, h('h1', {}, 'Race the world record'),
      h('p', {}, 'Every video is driven by the run timer read off the runner\'s own LiveSplit. Race shows who is ahead at the same clock time; split-aligned starts every segment together so you can compare the movement through each skip.')),
    h('div', { class: 'row' }));
  const modeCtl = h('div', { class: 'seg-ctl', role: 'group', 'aria-label': 'Sync mode' },
    h('button', { 'data-m': 'race', onclick: () => setMode('race') }, 'Race'),
    h('button', { 'data-m': 'split', onclick: () => setMode('split') }, 'Split-aligned'));
  head.lastChild.append(modeCtl);

  const picker = h('div', { class: 'row', style: { marginBottom: '12px' } });
  const grid = h('div', { class: 'cmp-grid' });
  const bigClock = h('span', { class: 'bigclock' }, '0:00.00');
  const segLabel = h('span', { class: 'pill' }, '');
  const waitPill = h('span', { class: 'pill warn hidden' }, 'buffering…');
  const playBtn = h('button', { class: 'btn pri big', onclick: () => toggle() }, '▶ Play');
  const scrub = scrubber({ length: 420, onSeek: (t, done) => group && group.seek(t - (mode === 'race' ? 0 : 0)), label: t => fmtRun(t, 1) });
  const transport = h('div', { class: 'transport' },
    playBtn,
    h('button', { class: 'btn', title: 'Previous split ([)', onclick: () => jumpSplit(-1) }, '⏮ Split'),
    h('button', { class: 'btn', title: 'Back 5 s', onclick: () => step(-5) }, '−5s'),
    h('button', { class: 'btn', title: 'Back 1 s', onclick: () => step(-1) }, '−1s'),
    h('button', { class: 'btn', title: 'Forward 1 s', onclick: () => step(1) }, '+1s'),
    h('button', { class: 'btn', title: 'Forward 5 s', onclick: () => step(5) }, '+5s'),
    h('button', { class: 'btn', title: 'Next split (])', onclick: () => jumpSplit(1) }, 'Split ⏭'),
    rateSelect(() => (group ? group.rate : 1), r => group && group.setRate(r)),
    waitPill, segLabel,
    h('span', { class: 'time' }, bigClock));
  const playerCard = h('div', { class: 'player' }, grid, transport, scrub.el);

  const table = h('div', { class: 'tablewrap' });
  const adjust = h('div', { class: 'card' });
  const addCard = h('div', { class: 'card' });
  root.append(head, picker, playerCard,
    h('div', { class: 'grid g2', style: { marginTop: '16px' } },
      h('div', { class: 'card' }, h('h2', {}, 'Splits'), table, h('p', { class: 'note' }, 'Click a row to jump every video to that segment. Gold = fastest segment among the runs shown. Δ is against the first run selected.')),
      h('div', { class: 'grid' }, adjust, addCard)));

  // ---------------------------------------------------------------- build
  function paintPicker() {
    fill(picker, h('span', { class: 'note' }, 'Runs (max 4):'), ...allRuns().map(r => {
      const i = selected.indexOf(r.key);
      return h('button', { class: 'chip' + (i >= 0 ? ' cur' : ''), 'aria-pressed': String(i >= 0), onclick: () => toggleRun(r.key) },
        i >= 0 ? h('span', { class: 'dot', style: { '--c': COLORS[i] } }) : '+', r.label, h('small', {}, fmtRun(runModel(r).time)));
    }));
    modeCtl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  }
  function toggleRun(k) {
    const i = selected.indexOf(k);
    if (i >= 0) { if (selected.length === 1) return toast('Keep at least one run'); selected.splice(i, 1); }
    else { if (selected.length >= 4) return toast('Four runs at most — deselect one first'); selected.push(k); }
    store.update(s => (s.prefs.compareRuns = selected.slice()));
    build();
  }
  function build(keepX) {
    const X = keepX ?? (group ? group.X : -2);
    if (group) group.destroy();
    cells.forEach(c => c.deck.destroy());
    fill(grid); grid.className = 'cmp-grid n' + selected.length;
    cells = selected.map((k, i) => {
      const run = allRuns().find(r => r.key === k);
      const cell = h('div', { class: 'cmp-cell', style: { '--c': COLORS[i] } });
      grid.append(cell);
      const deck = new Deck(cell);
      const clock = h('span', { class: 'clock' }, '0:00.00'), dl = h('span', { class: 'dl' }), flag = h('div', { class: 'flag hidden' });
      cell.append(flag, h('div', { class: 'hud' }, h('span', { class: 'who' }, h('span', { class: 'dot', style: { '--c': COLORS[i] } }), run.label), h('span', {}, dl, ' ', clock)));
      return { run, deck, clock, dl, flag, m: runModel(run) };
    });
    Promise.all(cells.map(c => c.deck.ready.then(() => c.deck.load(c.run.vid, Math.max(0, c.m.offset + X), { play: false })))).then(() => group && group.seek(X));
    group = new SyncGroup(cells.map(c => ({ deck: c.deck, model: c.m })), { mode, onTick });
    group.X = X;
    window.__cmp = { group, cells };
    paintPicker(); paintScrub(); paintTable(); paintAdjust(); paintAdd();
  }
  function setMode(m) {
    mode = m; store.update(s => (s.prefs.compareMode = m));
    group.mode = m; group.seek(clamp(group.X, -3, group.length()));
    paintPicker(); paintScrub();
  }
  function paintScrub() {
    if (!group) return;
    scrub.setLength(group.length());
    let marks = [];
    if (mode === 'split') marks = group.commonSplits().map((t, k) => ({ t, label: String(k + 1), title: SPLITS[k].name }));
    else {
      cells.forEach((c, i) => c.m.splits.forEach((t, k) => marks.push({ t, c: COLORS[i], title: `${c.run.label}: ${SPLITS[k].name} ${fmtRun(t)}`, label: i === 0 ? String(k + 1) : '' })));
      cells.forEach((c, i) => (c.run.moments || []).forEach(([t, txt]) => marks.push({ t, c: '#fff', title: `${c.run.runner}: ${txt}` })));
    }
    scrub.setMarks(marks);
  }

  // ---------------------------------------------------------------- live
  function onTick(X) {
    bigClock.textContent = fmtRun(Math.max(0, X), 2);
    scrub.set(Math.max(0, X));
    playBtn.textContent = group.playing ? '❚❚ Pause' : '▶ Play';
    waitPill.classList.toggle('hidden', !group.waiting);
    const ref = cells[0];
    const refT = ref ? clamp(group.shownT(group.entries[0]), 0, ref.m.time) : 0;
    let seg = 0;
    cells.forEach((c, i) => {
      const e = group.entries[i];
      const T = clamp(group.shownT(e), -9, c.m.time);
      c.clock.textContent = T < 0 ? '–' + fmtRun(-T, 1) : fmtRun(T, 2);
      const done = group.target(e).hold && X >= c.m.time - 0.05;
      if (i === 0) seg = group.target(e).seg;
      if (done) { c.flag.textContent = '🏁 ' + fmtRun(c.m.time); c.flag.classList.remove('hidden'); }
      else if (mode === 'split' && group.target(e).hold && X > 0) { c.flag.textContent = '✓ ' + SPLITS[group.target(e).seg].short; c.flag.classList.remove('hidden'); }
      else c.flag.classList.add('hidden');
      if (i === 0 || T <= 0) { c.dl.textContent = ''; return; }
      const p = progressAt(c.m, T);
      const d = T - timeAtProgress(ref.m, p);
      c.dl.textContent = fmtDelta(d); c.dl.className = 'dl ' + (d > 0.05 ? 'bad' : d < -0.05 ? 'good' : '');
    });
    segLabel.textContent = X < 0 ? 'pre-roll' : `${seg + 1}. ${SPLITS[seg].name}`;
    if (marking) paintMarking();
    adjustRefresh.forEach(f => f());
    void refT;
  }
  function toggle() { group.toggle(); keepAwake(group.playing); }
  function step(d) { group.seek(group.X + d); }
  function jumpSplit(dir) {
    const bounds = mode === 'split' ? [0, ...group.commonSplits()] : [0, ...cells[0].m.splits];
    const X = group.X + (dir < 0 ? -0.6 : 0.05);
    if (dir > 0) { const n = bounds.find(b => b > X); if (n != null) group.seek(n); }
    else { const p = [...bounds].reverse().find(b => b < X); group.seek(p ?? 0); }
  }

  // ---------------------------------------------------------------- split table
  function paintTable() {
    const best = SPLITS.map((_, k) => Math.min(...cells.map(c => c.m.segs[k])));
    const ref = cells[0].m;
    const rows = SPLITS.map((s, k) => h('tr', { style: { cursor: 'pointer' }, onclick: () => { group.seekSegment(k); }, title: 'Jump all videos to ' + s.name },
      h('td', {}, h('b', {}, `${k + 1}. `), s.name),
      ...cells.map((c, i) => {
        const seg = c.m.segs[k], d = c.m.splits[k] - ref.splits[k];
        return h('td', { class: 'num' },
          h('div', {}, fmtRun(c.m.splits[k], 1), i ? h('small', { class: d > 0 ? 'bad' : 'good' }, ' ' + fmtDelta(d)) : null),
          h('small', { class: seg === best[k] ? 'gold' : 'muted' }, fmtRun(seg, 1)));
      })));
    const sob = best.reduce((a, b) => a + b, 0);
    fill(table, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Split'), ...cells.map((c, i) => h('th', { class: 'num' }, h('span', { class: 'dot', style: { '--c': COLORS[i] } }), ' ', c.run.runner)))),
      h('tbody', {}, rows,
        h('tr', { class: 'hl' }, h('td', {}, h('b', {}, 'Sum of best (these runs)')), h('td', { class: 'num', colspan: cells.length }, h('b', { class: 'gold' }, fmtRun(sob, 1)))))));
  }

  // ---------------------------------------------------------------- adjust marks
  let adjustRefresh = [];
  function paintAdjust() {
    adjustRefresh = [];
    if (!editKey || !selected.includes(editKey)) editKey = selected[0];
    const ci = selected.indexOf(editKey), c = cells[ci];
    const ov = () => store.get().runs[editKey];
    const apply = (o) => {
      store.update(s => (s.runs[editKey] = o));
      c.m = runModel(c.run); group.entries[ci].model = c.m; group.hold();
      paintScrub(); paintTable(); paintAdjust();
    };
    const cur = () => ({ offset: c.m.offset, splits: c.m.splits.slice() });
    const now = () => c.deck.time() - c.m.offset;
    const offRow = nudgeRow('Zero', () => c.m.offset, v => { const o = cur(); o.offset = Math.max(0, v); apply(o); offRow.refresh(); }, () => c.deck.time());
    const rows = SPLITS.map((s, k) => {
      const r = nudgeRow(String(k + 1), () => c.m.splits[k], v => {
        const o = cur(); o.splits[k] = clamp(v, k ? o.splits[k - 1] + 0.1 : 0.1, k < SPLITS.length - 1 ? o.splits[k + 1] - 0.1 : 1e5); apply(o); r.refresh();
        group.seek(mode === 'race' ? o.splits[k] : group.X);
      }, now);
      r.el.title = s.name;
      adjustRefresh.push(() => r.refresh());
      return r.el;
    });
    fill(adjust, 
      h('h2', {}, 'Adjust split marks'),
      h('p', { class: 'note' }, 'Every change re-syncs the videos instantly. “Zero” is the video second where the run timer reads 0:00.00. “= now” takes the current frame of that run\'s video. Pause and use , . to step 0.1 s.'),
      h('div', { class: 'row', style: { margin: '6px 0' } },
        h('select', { 'aria-label': 'Run to adjust', onchange: e => { editKey = e.target.value; paintAdjust(); } }, selected.map(k => h('option', { value: k, selected: k === editKey }, allRuns().find(r => r.key === k).label))),
        ov() ? h('span', { class: 'pill warn' }, 'edited') : h('span', { class: 'pill ok' }, 'as measured'),
        h('button', { class: 'btn sm', disabled: !ov(), onclick: () => { store.update(s => delete s.runs[editKey]); c.m = runModel(c.run); group.entries[ci].model = c.m; group.hold(); paintScrub(); paintTable(); paintAdjust(); } }, 'Reset'),
        h('button', { class: 'btn sm', onclick: () => download(`${editKey}-splits.json`, JSON.stringify({ key: editKey, vid: c.run.vid, offset: c.m.offset, splits: c.m.splits }, null, 1)) }, 'Export')),
      offRow.el, ...rows,
      h('p', { class: 'note' }, c.run.precision ? 'Measured precision: ' + c.run.precision : ''));
  }

  // ---------------------------------------------------------------- add your run
  function paintAdd() {
    const url = h('input', { type: 'url', placeholder: 'YouTube link to your run', style: { flex: 1, minWidth: '200px' } });
    const name = h('input', { type: 'text', placeholder: 'Runner', value: 'You', style: { width: '110px' } });
    const splitsIn = h('input', { type: 'text', placeholder: 'Splits e.g. 1:25.3 2:31 3:30 5:01 7:05 (optional)', style: { flex: 1, minWidth: '220px' } });
    fill(addCard, h('h2', {}, 'Race your own run'),
      h('p', { class: 'note' }, 'Paste the video, then either type your LiveSplit split times or mark them while watching: press Z at the frame the timer starts, then S each time “EXTRACTION POINT UNLOCKED” appears and at the final cut to black.'),
      h('div', { class: 'row' }, url, name),
      h('div', { class: 'row', style: { marginTop: '6px' } }, splitsIn, h('button', { class: 'btn pri', onclick: () => addRun(url.value, name.value, splitsIn.value) }, 'Add run')),
      st.customRuns.length ? h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', { class: 'note' }, 'Your runs:'), store.get().customRuns.map(r => h('span', { class: 'pill' }, r.label, h('button', { class: 'btn xs ghost', title: 'Delete', onclick: () => delRun(r.key) }, '✕')))) : null,
      marking ? markingPanel : null);
  }
  const markingPanel = h('div', { class: 'callout info', style: { marginTop: '10px' } });
  function addRun(link, runner, splitText) {
    const m = String(link).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/) || String(link).match(/^([\w-]{11})$/);
    if (!m) return toast('That does not look like a YouTube link', 'bad');
    const vid = m[1];
    const splits = splitText.trim() ? splitText.trim().split(/[\s,;]+/).map(parseTime) : [];
    if (splits.length && (splits.length !== SPLITS.length || splits.some(x => !isFinite(x)))) return toast(`Enter all ${SPLITS.length} cumulative split times, or leave it empty to mark them`, 'bad');
    const key = 'u_' + uid();
    const run = { key, runner: runner || 'You', label: `${runner || 'You'} (${splits.length ? fmtRun(splits[4], 0) : 'unmarked'})`, vid, offset: 0, splits: splits.length ? splits : SPLITS.map((_, k) => (k + 1) * 90), time: splits.length ? splits[4] : 450, custom: true };
    if (!BY_ID[vid]) BY_ID[vid] = { id: vid, title: 'Your run', author: run.runner, dur: 3600 };
    store.update(s => s.customRuns.push(run));
    if (selected.length >= 4) selected.pop();
    selected.push(key); store.update(s => (s.prefs.compareRuns = selected.slice()));
    if (!splits.length) { marking = { key, step: 0 }; toast('Marking mode: play your video, press Z when the timer starts, then S at each split'); }
    build(0);
    if (marking) { mode !== 'race' && setMode('race'); }
  }
  function delRun(key) {
    store.update(s => { s.customRuns = s.customRuns.filter(r => r.key !== key); delete s.runs[key]; });
    selected = selected.filter(k => k !== key); if (!selected.length) selected = ['tp650'];
    store.update(s => (s.prefs.compareRuns = selected.slice()));
    build();
  }
  function paintMarking() {
    const c = cells.find(x => x.run.key === marking.key);
    if (!c) { marking = null; return; }
    const labels = ['timer start (Z)', ...SPLITS.map(s => s.name + ' (S)')];
    fill(markingPanel, h('b', {}, 'Marking ', c.run.runner, '’s run — '), `next: ${labels[marking.step] || 'done'} · video ${fmtClock(c.deck.time(), true)}`,
      h('div', { class: 'note' }, 'Tip: in marking mode only your video needs to play — pause the others by deselecting them, or use , and . to step frames while paused.'));
  }
  function markNow(kind) {
    const c = cells.find(x => x.run.key === marking.key);
    if (!c) return;
    const t = Math.round(c.deck.time() * 100) / 100;
    store.update(s => {
      const r = s.customRuns.find(x => x.key === marking.key);
      if (kind === 'zero') { r.offset = t; marking.step = 1; r.markSplits = []; }
      else {
        if (marking.step === 0) return toast('Press Z at the timer start first');
        r.markSplits.push(t - r.offset);
        marking.step++;
        if (r.markSplits.length === SPLITS.length) { r.splits = r.markSplits; r.time = r.splits[4]; r.label = `${r.runner} ${fmtRun(r.time, 0)}`; delete r.markSplits; marking = null; toast('Run marked — racing from the start', 'good'); }
      }
    });
    if (kind === 'zero' || !marking) { const done = !marking; c.run = store.get().customRuns.find(x => x.key === c.run.key) || c.run; if (done) build(0); else paintAdd(); }
  }

  // ---------------------------------------------------------------- keys
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -5 : -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? 5 : 1); }
    else if (e.key === ',') { if (group.playing) group.pause(); step(-0.1); }
    else if (e.key === '.') { if (group.playing) group.pause(); step(0.1); }
    else if (e.key === '[') jumpSplit(-1);
    else if (e.key === ']') jumpSplit(1);
    else if (/^[1-5]$/.test(e.key)) group.seekSegment(+e.key - 1);
    else if (e.key === 'm' || e.key === 'M') setMode(mode === 'race' ? 'split' : 'race');
    else if (marking && (e.key === 'z' || e.key === 'Z')) markNow('zero');
    else if (marking && (e.key === 's' || e.key === 'S')) markNow('split');
  };
  document.addEventListener('keydown', onKey);

  build(params.seg != null ? null : -2);
  if (params.seg != null) setTimeout(() => group.seekSegment(+params.seg), 50);
  if (params.t != null) setTimeout(() => group.seek(+params.t), 50);
  return () => { keepAwake(false); document.removeEventListener('keydown', onKey); group && group.destroy(); cells.forEach(c => c.deck.destroy()); };
}

export { ytUrl, communityBest };
