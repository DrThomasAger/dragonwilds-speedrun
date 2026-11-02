// Multi-run synchronisation on a shared run clock.
//
// Every reference run is described by a timer offset (video second at which the
// run timer reads 0:00.00) and cumulative split times. From that:
//   race  mode — every video shows the same run-timer value, like a live race.
//   split mode — each segment starts together for every run; faster runs hold on
//                their split frame until the slowest one arrives.
// A rAF loop corrects drift by re-seeking any deck that is >0.25 s off target and
// freezes the master clock while any deck is buffering, so nothing desyncs.

import { ST } from './player.js';

export function model(run, override) {
  const o = override || {};
  const offset = o.offset ?? run.offset;
  const splits = (o.splits || run.splits).slice();
  const starts = [0, ...splits.slice(0, -1)];
  const segs = splits.map((s, k) => s - starts[k]);
  return { ...run, offset, splits, starts, segs, time: splits[splits.length - 1] };
}

// Route progress (segment index + fraction) at run time T.
export function progressAt(m, T) {
  if (T <= 0) return 0;
  for (let k = 0; k < m.splits.length; k++) if (T < m.splits[k]) return k + (T - m.starts[k]) / m.segs[k];
  return m.splits.length;
}
export function timeAtProgress(m, p) {
  if (p <= 0) return 0;
  const k = Math.min(Math.floor(p), m.splits.length - 1);
  if (p >= m.splits.length) return m.time;
  return m.starts[k] + (p - k) * m.segs[k];
}
export function segmentAt(m, T) { for (let k = 0; k < m.splits.length; k++) if (T < m.splits[k]) return k; return m.splits.length - 1; }

export class SyncGroup {
  constructor(entries, { mode = 'race', onTick, preroll = 3 } = {}) {
    this.entries = entries;         // [{deck, model}]
    this.mode = mode; this.X = -preroll; this.preroll = preroll;
    this.playing = false; this.rate = 1; this.waiting = false;
    this.onTick = onTick; this.last = performance.now(); this.seeks = 0;
    this.loop = () => { this.tick(); this.raf = requestAnimationFrame(this.loop); };
    this.raf = requestAnimationFrame(this.loop);
    window.__sync = this;
  }
  setModels(models) { models.forEach((m, i) => this.entries[i] && (this.entries[i].model = m)); this.hold(); }

  // Common split-mode timeline: segment k lasts as long as the slowest run's segment k.
  commonSegs() {
    const n = Math.max(...this.entries.map(e => e.model.splits.length));
    return Array.from({ length: n }, (_, k) => Math.max(...this.entries.map(e => e.model.segs[k] || 0)));
  }
  length() {
    if (this.mode === 'split') return this.commonSegs().reduce((a, b) => a + b, 0);
    return Math.max(...this.entries.map(e => e.model.time));
  }
  // Common split-mode boundaries, for drawing markers on the master scrubber.
  commonSplits() { let acc = 0; return this.commonSegs().map(s => (acc += s)); }

  // Target video second for entry e at master position X; hold=true means "parked".
  target(e, X = this.X) {
    const m = e.model;
    let T;
    if (this.mode === 'split' && X >= 0) {
      const cs = this.commonSegs();
      let acc = 0, k = 0;
      while (k < cs.length - 1 && X >= acc + cs[k]) { acc += cs[k]; k++; }
      const into = X - acc;
      const seg = m.segs[k] ?? 0;
      T = m.starts[k] + Math.min(into, seg);
      const parked = into >= seg;
      return { t: m.offset + T, T, hold: parked, seg: k };
    }
    T = Math.min(X, m.time);
    const t = Math.max(0, m.offset + T);
    return { t, T, hold: X >= m.time || m.offset + X < 0, seg: segmentAt(m, Math.max(T, 0)) };
  }
  // Run time actually displayed by entry e right now (from its video position).
  shownT(e) { return e.deck.time() - e.model.offset; }

  play() { this.playing = true; this.last = performance.now(); this.entries.forEach(e => (e.parked = null)); }
  pause() { this.playing = false; this.entries.forEach(e => e.deck.pause()); }
  toggle() { this.playing ? this.pause() : this.play(); }
  setRate(r) { this.rate = r; this.entries.forEach(e => e.deck.setRate(r)); }
  setMode(m) { const T = this.mode === 'race' ? this.X : this.X; this.mode = m; this.seek(Math.min(T, this.length())); }
  seek(X) {
    this.X = Math.max(-this.preroll, Math.min(X, this.length()));
    this.entries.forEach(e => { const tg = this.target(e); e.deck.seek(tg.t, true); e.parked = null; this.seeks++; });
    this.last = performance.now();
    this.tick(true);
  }
  // Jump every deck to the start of segment k (common timeline).
  seekSegment(k) {
    if (this.mode === 'split') { const cs = this.commonSegs(); this.seek(cs.slice(0, k).reduce((a, b) => a + b, 0)); }
    else { const m = this.entries[0].model; this.seek(m.starts[k]); }
  }
  hold() { this.seek(this.X); }

  tick(force = false) {
    const now = performance.now();
    const dt = (now - this.last) / 1000; this.last = now;
    const active = this.entries.filter(e => !this.target(e).hold);
    this.waiting = this.playing && active.some(e => e.deck.state === ST.BUFFERING || e.deck.state === ST.UNSTARTED || e.deck.state === ST.CUED);
    if (this.playing && !this.waiting) {
      this.X += dt * this.rate;
      if (this.X >= this.length()) { this.X = this.length(); this.pause(); }
    }
    for (const e of this.entries) {
      const tg = this.target(e);
      const d = e.deck;
      if (!d.p) continue;
      if (!this.playing || tg.hold) {
        if (d.playing) d.pause();
        if (tg.hold && e.parked !== tg.t) { d.seek(tg.t, true); e.parked = tg.t; }
        continue;
      }
      e.parked = null;
      if (d.state === ST.PAUSED || d.state === ST.CUED || d.state === ST.ENDED || d.state === ST.UNSTARTED) {
        if (Math.abs(d.time() - tg.t) > 0.08) d.seek(tg.t, true);
        d.play();
        continue;
      }
      if (d.state === ST.PLAYING) {
        const drift = d.time() - tg.t;
        e.drift = drift;
        if (Math.abs(drift) > 0.25) { d.seek(tg.t, true); this.seeks++; }
      }
    }
    this.onTick && this.onTick(this.X, force);
  }
  destroy() { cancelAnimationFrame(this.raf); if (window.__sync === this) window.__sync = null; }
}
