// Run navigator — the in-raid companion. Pre-flight → run (split by split, skip by
// skip, live delta) → summary. Shares the timer record with the Timer page.
import { h, fmtRun, fmtDelta, isTyping, toast, fill } from '../lib/util.js';
import { SplitTimer, recordAttempt, segmentsOf } from '../lib/timer.js';
import { Reel } from '../lib/reel.js';
import { keepAwake } from '../lib/pwa.js';
import { SPLITS, RUNS, communityBest } from '../data/raid.js';
import { model } from '../lib/sync.js';
import { ROUTE, REQUIREMENTS, GEAR } from '../data/route.js';
import { comparisons } from './timer.js';
import * as store from '../lib/store.js';
import { emit } from '../lib/bridge.js';
import * as voice from '../lib/speak.js';

export const title = 'Run navigator';
export const keys = [['Space / Numpad1', 'Start / split'], ['S', 'Spoken call-outs on/off'], ['N / →', 'Next skip'], ['B / ←', 'Previous skip'], ['Backspace', 'Undo split'], ['R', 'Reset'], ['V', 'Toggle reference clip']];

const N = SPLITS.length;
const PREFLIGHT = [
  ['Fleet Foot Infusion active', 'halves sprint stamina cost'],
  ['Mace + 2H mage staff + mage armour', 'Thane kill and the Heart'],
  ['Air Garou Thane respawned', 'slept through a night since the last attempt (~15 min respawn)'],
  ['Spell ring: Windstep, Surge, a targeted AoE', 'dive cancel and flight need the AoE'],
  ['LiveSplit / recording running', 'video is required on speedrun.com'],
];

export function mount(root) {
  const rec = store.get().timer;
  const prefs = store.get().prefs;
  let cmpId = rec.comparison || 'beat650';
  let skipIdx = 0, showClip = prefs.runClip !== false, checks = new Set();
  const timer = new SplitTimer(N, { onChange: onTimer });
  let reel = null, raf = 0, phase = 'pre';

  const wrap = h('div', { class: 'runnav' });
  root.append(wrap);

  // ------------------------------------------------------------ pre-flight
  function paintPre() {
    phase = 'pre'; keepAwake(false); destroyClip();
    const cmpSel = h('select', { 'aria-label': 'Compare against', onchange: () => { cmpId = cmpSel.value; store.update(s => (s.timer.comparison = cmpId)); } }, comparisons().map(c => h('option', { value: c.id, selected: c.id === cmpId }, c.name)));
    const items = PREFLIGHT.map(([t, d], i) => h('label', { class: 'pf' + (checks.has(i) ? ' ok' : '') },
      h('input', { type: 'checkbox', checked: checks.has(i), onchange: e => { e.target.checked ? checks.add(i) : checks.delete(i); e.target.closest('label').classList.toggle('ok', e.target.checked); } }),
      h('span', {}, h('b', {}, t), h('small', {}, d))));
    fill(wrap, 
      h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Run navigator'), h('p', {}, 'Your in-raid second screen. Put it on the Fold or a second monitor: one giant split button, the skip you are on, how to do it, and where you stand against the record.'))),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card' }, h('h2', {}, 'Pre-flight'), h('div', { class: 'grid', style: { gap: '6px' } }, items),
          h('div', { class: 'row', style: { marginTop: '12px' } }, h('label', { class: 'note' }, 'Race against ', cmpSel), voice.toggleButton('calls', 'Call-outs')),
          h('button', { class: 'btn pri big', style: { width: '100%', marginTop: '12px', justifyContent: 'center' }, onclick: () => { timer.start(); } }, '▶ Start run  ', h('kbd', {}, 'Space')),
          h('p', { class: 'note' }, 'Start on the first frame the loading icon disappears entering the raid.'),
          h('h3', { style: { marginTop: '16px' } }, 'Segment practice'),
          h('p', { class: 'note' }, 'Time one split on its own: start when you leave the previous extraction point, split on the next.'),
          h('div', { class: 'grid', style: { gap: '6px' } }, SPLITS.map((sp, k) => { const st = segStats(k); return h('button', { class: 'btn', style: { justifyContent: 'space-between' }, onclick: () => paintSeg(k) }, h('span', {}, `${k + 1}. ${sp.name}`), h('small', { class: 'mono muted' }, st.n ? `best ${fmtRun(st.best, 1)} · ${st.n} tries` : 'not practised')); }))),
        h('div', { class: 'card' }, h('h2', {}, 'Route at a glance'),
          h('ol', { class: 'glance' }, ROUTE.map((sp, k) => h('li', {}, h('b', {}, SPLITS[k].name), h('div', { class: 'note' }, sp.skips.filter(s => s.status !== 'patched').map(s => s.name).join(' → '))))),
          h('h3', {}, 'Requirements'), h('div', { class: 'chips' }, REQUIREMENTS.map(r => h('a', { class: 'chip', href: `#/wiki?id=${r.wiki}` }, r.name, h('small', {}, r.need.split(' · ')[0])))))));
  }

  // ------------------------------------------------------------ segment practice
  function segStats(k) {
    const log = ((store.get().segPractice || {})[k]) || [];
    const times = log.map(x => x.t);
    const last10 = times.slice(-10);
    return { n: times.length, best: times.length ? Math.min(...times) : null, avg: last10.length ? last10.reduce((a, b) => a + b, 0) / last10.length : null, last: times.slice(-12) };
  }
  let segTimer = null;
  function paintSeg(k) {
    phase = 'seg'; keepAwake(true);
    const c = cmp(), ref = c.splits[k] - (k ? c.splits[k - 1] : 0);
    const cname = c.name.replace(' (WR)', '');
    const sk = skipsFor(k);
    const clock = h('div', { class: 'rn-clock mono' }, '0:00.00');
    const hist = h('div', { class: 'rn-list' });
    const big = h('button', { class: 'rn-big' });
    const paintHist = () => {
      const st = segStats(k);
      fill(hist, h('div', { class: 'rn-row cur' }, h('span', {}, 'Best'), h('span', { class: 'mono' }, fmtRun(st.best, 2)), h('span', { class: 'mono ' + (st.best != null && st.best <= ref ? 'good' : 'bad') }, st.best != null ? fmtDelta(st.best - ref) : '')),
        h('div', { class: 'rn-row' }, h('span', {}, 'Avg last 10'), h('span', { class: 'mono' }, fmtRun(st.avg, 2)), h('span', {})),
        h('div', { class: 'rn-row' }, h('span', {}, cname), h('span', { class: 'mono' }, fmtRun(ref, 2)), h('span', {})),
        ...st.last.slice().reverse().map(t => h('div', { class: 'rn-row done' }, h('span', {}, ''), h('span', { class: 'mono' }, fmtRun(t, 2)), h('span', { class: 'mono ' + (t <= ref ? 'good' : 'bad') }, fmtDelta(t - ref)))));
    };
    const cue = k === N - 1 ? 'on the cut to black' : 'on Extraction point unlocked';
    const paintBig = () => fill(big, h('b', {}, segTimer.phase === 'idle' ? 'START' : segTimer.phase === 'done' ? 'AGAIN' : 'SPLIT'), h('span', {}, segTimer.phase === 'running' ? cue : `${SPLITS[k].name}: leave the previous extraction point`));
    segTimer = new SplitTimer(1, { onChange: type => {
      if (type === 'finish') {
        const t = segTimer.splits[0];
        const prevBest = segStats(k).best;
        store.update(s => { s.segPractice ||= {}; (s.segPractice[k] ||= []).push({ t, at: Date.now() }); });
        emit('segment', `${SPLITS[k].name} practice ${fmtRun(t, 2)} (${fmtDelta(t - ref)} vs ${cname})`);
        const pb = prevBest == null || t < prevBest;
        toast(pb ? `Practice best ${fmtRun(t, 2)}` : `${fmtRun(t, 2)} (${fmtDelta(t - ref)} vs ${cname})`, pb ? 'gold' : t <= ref ? 'good' : '');
        voice.callout('calls', `${voice.sayTime(t, 2)}. ${voice.sayDelta(t - ref)} versus ${cname}.${pb ? ' Practice best!' : ''}`);
        if (navigator.vibrate) navigator.vibrate(40);
        paintHist();
      }
      paintBig();
    } });
    big.addEventListener('click', () => { if (segTimer.phase === 'done') segTimer.reset(); else segTimer.split(); });
    const s0 = sk[0];
    fill(wrap, h('div', { class: 'rn' },
      h('div', { class: 'rn-head' }, h('div', {}, h('div', { class: 'rn-split' }, h('span', { class: 'pill' }, 'Segment practice'), ' ', h('b', {}, SPLITS[k].name)), h('div', { class: 'rn-delta mono muted' }, `${cname} did it in ${fmtRun(ref, 1)}`)), clock),
      h('div', { class: 'rn-body' },
        h('div', { class: 'rn-main' }, h('div', { class: 'rn-skip' }, h('div', { class: 'note' }, 'Skips in this split'), h('ol', {}, sk.map(x => h('li', {}, h('a', { href: `#/practice?skip=${x.id}` }, x.name))))),
          h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: () => { segTimer = null; paintPre(); } }, '‹ Back'), k > 0 ? h('button', { class: 'btn', onclick: () => paintSeg(k - 1) }, '‹ Prev split') : null, k < N - 1 ? h('button', { class: 'btn', onclick: () => paintSeg(k + 1) }, 'Next split ›') : null)),
        h('div', { class: 'rn-side' }, el.clipHost = h('div', { class: 'rn-clip' + (showClip ? '' : ' hidden') }), hist)),
      big));
    paintHist(); paintBig();
    // reference = the fastest recorded version of this split
    const best = communityBest(RUNS.map(r => model(r, store.get().runs[r.key])))[k];
    const br = model(RUNS.find(r => r.key === best.run), store.get().runs[best.run]);
    if (showClip) { destroyClip(); playClip({ vid: br.vid, in: +(br.offset + best.from).toFixed(2), out: +(br.offset + best.to).toFixed(2), label: `${best.runner} ${SPLITS[k].short}` }); }
    void s0;
    const f = () => { if (phase !== 'seg' || !segTimer) return; const t = segTimer.now(); clock.textContent = fmtRun(t, 2); clock.classList.toggle('behind', t > ref); raf = requestAnimationFrame(f); };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(f);
  }

  // ------------------------------------------------------------ running
  const el = {};
  function paintRun() {
    phase = 'run'; keepAwake(true);
    el.clock = h('div', { class: 'rn-clock mono' }, '0:00.00');
    el.delta = h('div', { class: 'rn-delta mono' });
    el.split = h('div', { class: 'rn-split' });
    el.skip = h('div', { class: 'rn-skip' });
    el.list = h('div', { class: 'rn-list' });
    el.clipHost = h('div', { class: 'rn-clip' + (showClip ? '' : ' hidden') });
    el.big = h('button', { class: 'rn-big', onclick: () => timer.split() });
    el.next = h('div', { class: 'rn-next note' });
    fill(wrap, 
      h('div', { class: 'rn' },
        h('div', { class: 'rn-head' }, h('div', {}, el.split, el.delta), el.clock),
        h('div', { class: 'rn-body' },
          h('div', { class: 'rn-main' }, el.skip, el.next,
            h('div', { class: 'row', style: { marginTop: '8px' } },
              h('button', { class: 'btn', onclick: () => moveSkip(-1) }, '‹ Prev skip'),
              h('button', { class: 'btn', onclick: () => moveSkip(1) }, 'Next skip ›'),
              h('button', { class: 'btn', onclick: () => toggleClip() }, '🎬 Clip'),
              voice.toggleButton('calls', 'Call-outs'),
              h('span', { class: 'spacer' }),
              h('button', { class: 'btn', onclick: () => timer.undo() }, '↶ Undo'),
              h('button', { class: 'btn', onclick: () => reset() }, 'Reset'))),
          h('div', { class: 'rn-side' }, el.clipHost, el.list)),
        el.big));
    skipIdx = 0; paintSplit(); loop();
  }
  function skipsFor(k) { return (ROUTE[k] || { skips: [] }).skips.filter(s => s.status !== 'patched'); }
  function paintSplit() {
    const k = Math.min(timer.index, N - 1), sk = skipsFor(k), s = sk[skipIdx];
    fill(el.split, h('span', { class: 'pill' }, `Split ${k + 1}/${N}`), ' ', h('b', {}, SPLITS[k].name));
    fill(el.skip, s ? h('div', {},
      h('div', { class: 'note' }, `Skip ${skipIdx + 1} of ${sk.length}`),
      h('h2', {}, s.name),
      s.how && s.how.length ? h('ol', {}, s.how.map(x => h('li', {}, x))) : s.text ? h('p', {}, s.text) : h('p', { class: 'note' }, 'Watch the clip for the line.')) : h('h2', {}, 'Run it out'));
    el.next.textContent = sk[skipIdx + 1] ? `Next: ${sk[skipIdx + 1].name}` : k < N - 1 ? `Then: split on “Extraction point unlocked” → ${SPLITS[k + 1].name}` : 'Then: the Heart — split on the cut to black';
    fill(el.list, ...SPLITS.map((sp, j) => h('div', { class: 'rn-row' + (j === k ? ' cur' : j < timer.index ? ' done' : '') },
      h('span', {}, sp.short), h('span', { class: 'mono' }, timer.splits[j] != null ? fmtRun(timer.splits[j], 1) : ''), h('span', { class: 'mono dl', dataset: { k: j } }))));
    paintDeltas();
    fill(el.big, h('b', {}, k === N - 1 ? 'FINISH' : 'SPLIT'), h('span', {}, k === N - 1 ? 'on the cut to black' : `on “Extraction point unlocked” → ${SPLITS[k + 1].name}`));
    if (showClip && s && s.clips.length) playClip(s.clips[0]);
  }
  function paintDeltas() {
    const c = cmp();
    el.list.querySelectorAll('.dl').forEach(d => {
      const j = +d.dataset.k, t = timer.splits[j];
      if (t == null || c.splits[j] == null) { d.textContent = ''; return; }
      const v = t - c.splits[j]; d.textContent = fmtDelta(v); d.className = 'mono dl ' + (v > 0 ? 'bad' : 'good');
    });
  }
  function cmp() { return comparisons().find(c => c.id === cmpId) || comparisons()[0]; }
  function loop() {
    cancelAnimationFrame(raf);
    const f = () => {
      if (phase !== 'run') return;
      const t = timer.now(), k = timer.index, c = cmp();
      el.clock.textContent = fmtRun(t, 2);
      const target = c.splits[Math.min(k, N - 1)];
      if (target != null) {
        const d = t - target;
        el.delta.textContent = d > -30 ? `${fmtDelta(d)} vs ${c.name.replace(/ \(WR\)/, '')} at ${SPLITS[Math.min(k, N - 1)].short}` : `${c.name.replace(/ \(WR\)/, '')} splits at ${fmtRun(target, 1)}`;
        el.delta.className = 'rn-delta mono ' + (d > 0 ? 'bad' : d > -30 ? 'good' : 'muted');
        el.clock.classList.toggle('behind', d > 0);
      }
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
  }
  function moveSkip(d) { const sk = skipsFor(Math.min(timer.index, N - 1)); const was = skipIdx; skipIdx = Math.max(0, Math.min(sk.length - 1, skipIdx + d)); paintSplit(); if (skipIdx !== was && sk[skipIdx]) say(`${sk[skipIdx].name}.`); }
  function toggleClip() { showClip = !showClip; store.update(s => (s.prefs.runClip = showClip)); el.clipHost.classList.toggle('hidden', !showClip); if (!showClip) destroyClip(); else paintSplit(); }
  function playClip(c) {
    if (reel && !el.clipHost.contains(reel.stage)) destroyClip();
    if (!reel) { reel = new Reel(el.clipHost); reel.decks.forEach(d => (d.muteLock = true)); reel.loopClip = true; }
    if (reel.clip && reel.clip.vid === c.vid && reel.clip.in === c.in) return;
    reel.setClips([{ ...c }], { keepPosition: false }); reel.i = -1; reel.playClip(0);
  }
  function destroyClip() { if (reel) { reel.destroy(); reel = null; } }

  // ------------------------------------------------------------ spoken call-outs
  const cname = () => cmp().name.replace(/ \(WR\)/, '').replace(/ \(.*\)$/, '');
  const say = text => voice.callout('calls', text);
  function nextStep() {
    const k = Math.min(timer.index, N - 1), sk = skipsFor(k);
    return sk[0] ? `Next: ${sk[0].name}.` : k === N - 1 ? 'Next: the Heart.' : '';
  }
  function sayStart() { const sk = skipsFor(0); say(`Go. ${SPLITS[0].name}.${sk[0] ? ' First: ' + sk[0].name + '.' : ''}`); }
  function saySplit(k, gold) {
    const t = timer.splits[k], c = cmp(), ref = c.splits[k];
    const pace = ref != null ? ` ${voice.sayDelta(t - ref)} versus ${cname()}.` : '';
    say(`${SPLITS[k].name}, ${voice.sayTime(t)}.${pace}${gold ? ' Gold split.' : ''} ${timer.index < N ? SPLITS[timer.index].name + '. ' + nextStep() : ''}`);
  }
  function sayFinish(l) {
    const t = timer.splits[N - 1], ref = cmp().splits[N - 1];
    say(`Finished, ${voice.sayTime(t, 2)}.${l.isPB ? ' New personal best!' : ''}${ref != null ? ' ' + voice.sayDelta(t - ref) + ' versus ' + cname() + '.' : ''}`);
  }

  // ------------------------------------------------------------ summary
  let last = null;
  function paintDone() {
    phase = 'done'; keepAwake(false); destroyClip();
    const c = cmp(), segs = segmentsOf(timer.splits);
    fill(wrap, h('div', { class: 'card' },
      h('div', { class: 'row' }, h('h1', { style: { margin: 0 } }, last.isPB ? '🏆 New PB' : 'Run complete'), h('span', { class: 'spacer' }), h('span', { class: 'bigclock ' + (last.isPB ? 'gold' : '') }, fmtRun(timer.splits[N - 1], 2))),
      h('table', { style: { marginTop: '10px' } }, h('thead', {}, h('tr', {}, h('th', {}, 'Split'), h('th', { class: 'num' }, 'Segment'), h('th', { class: 'num' }, 'Split'), h('th', { class: 'num' }, 'vs ' + c.name.split(' ')[0]))),
        h('tbody', {}, SPLITS.map((s, k) => h('tr', {}, h('td', {}, s.name, last.golds.includes(k) ? h('span', { class: 'pill warn', style: { marginLeft: '6px' } }, 'gold') : null),
          h('td', { class: 'num' }, fmtRun(segs[k], 2)), h('td', { class: 'num' }, fmtRun(timer.splits[k], 2)),
          h('td', { class: 'num ' + (timer.splits[k] > c.splits[k] ? 'bad' : 'good') }, fmtDelta(timer.splits[k] - c.splits[k])))))),
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn pri big', onclick: () => { timer.reset(); paintPre(); } }, '↻ Next attempt'),
        h('a', { class: 'btn', href: '#/timer' }, 'Timer & LiveSplit export'),
        h('a', { class: 'btn', href: '#/compare' }, 'Race your splits'))));
  }

  // ------------------------------------------------------------ timer events
  function onTimer(type) {
    if (type === 'start') { emit('run-start', 'Raid run started'); paintRun(); sayStart(); return; }
    if (type === 'finish') { last = recordAttempt(rec, timer.splits, { done: true }); emit('finish', `${last.isPB ? 'NEW PB ' : 'Finished '}${fmtRun(timer.splits[N - 1], 2)}`, { splits: timer.splits, golds: last.golds }); store.update(s => (s.timer = rec)); if (last.isPB) toast('New PB!', 'gold'); sayFinish(last); paintDone(); return; }
    if (type === 'reset') return;
    if (type === 'split' || type === 'undo' || type === 'skip') {
      skipIdx = 0;
      if (type === 'split') { emit('split', `${SPLITS[timer.index - 1].name} ${fmtRun(timer.splits[timer.index - 1], 2)}`); const k = timer.index - 1; const segs = segmentsOf(timer.splits); const gold = rec.best[k] == null || segs[k] < rec.best[k]; if (gold) toast(`Gold! ${SPLITS[k].short} ${fmtRun(segs[k], 1)}`, 'gold'); if (navigator.vibrate) navigator.vibrate(40); saySplit(k, gold); }
      if (type === 'undo') say(`Split undone. Back in ${SPLITS[Math.min(timer.index, N - 1)].name}.`);
      if (phase === 'run') paintSplit();
    }
  }
  function reset() {
    if (timer.splits.length && timer.phase !== 'done') { recordAttempt(rec, timer.splits, { done: false }); store.update(s => (s.timer = rec)); toast(`Reset in ${SPLITS[Math.min(timer.index, N - 1)].short} — logged`); emit('reset', `Reset in ${SPLITS[Math.min(timer.index, N - 1)].name}`); say('Reset. Logged.'); }
    timer.reset(); paintPre();
  }
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    const k = e.code;
    if (phase === 'seg' && (k === 'Space' || k === 'Numpad1')) { e.preventDefault(); if (segTimer.phase === 'done') segTimer.reset(); else segTimer.split(); return; }
    if (phase === 'seg' && (k === 'KeyR' || k === 'Numpad3')) { segTimer.reset(); return; }
    if (k === 'KeyS') { voice.setToggle('calls', !voice.enabled('calls')); if (!voice.enabled('calls')) voice.stop(); toast(`Spoken call-outs ${voice.enabled('calls') ? 'on' : 'off'}`); return; }
    if (k === 'Space' || k === 'Numpad1') { e.preventDefault(); if (phase === 'done') { timer.reset(); paintPre(); } else timer.split(); }
    else if (phase !== 'run') return;
    else if (k === 'KeyN' || k === 'ArrowRight') moveSkip(1);
    else if (k === 'KeyB' || k === 'ArrowLeft') moveSkip(-1);
    else if (k === 'Backspace' || k === 'Numpad8') { e.preventDefault(); timer.undo(); }
    else if (k === 'KeyR' || k === 'Numpad3') reset();
    else if (k === 'KeyV') toggleClip();
  };
  document.addEventListener('keydown', onKey);
  paintPre();
  window.__run = timer;
  return () => { phase = 'gone'; cancelAnimationFrame(raf); keepAwake(false); destroyClip(); document.removeEventListener('keydown', onKey); };
}
export { GEAR };
