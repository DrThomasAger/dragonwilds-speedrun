// In-browser split timer with LiveSplit semantics (split / undo / skip / reset),
// golds, PB tracking and arbitrary comparisons.

export class SplitTimer {
  constructor(n, { onChange } = {}) {
    this.n = n; this.onChange = onChange;
    this.reset(false);
  }
  reset(notify = true) {
    this.phase = 'idle'; this.t0 = 0; this.pausedAt = 0; this.pausedTotal = 0; this.splits = [];
    notify && this.emit('reset');
  }
  now() {
    if (this.phase === 'idle') return 0;
    if (this.phase === 'done') return this.splits[this.n - 1];
    const end = this.phase === 'paused' ? this.pausedAt : performance.now();
    return (end - this.t0 - this.pausedTotal) / 1000;
  }
  get index() { return this.splits.length; }
  start() { if (this.phase !== 'idle') return; this.phase = 'running'; this.t0 = performance.now(); this.startedAt = Date.now(); this.emit('start'); }
  split() {
    if (this.phase === 'idle') return this.start();
    if (this.phase !== 'running') return;
    this.splits.push(this.now());
    if (this.splits.length >= this.n) { this.phase = 'done'; this.emit('finish'); } else this.emit('split');
  }
  skip() { if (this.phase !== 'running' || this.splits.length >= this.n - 1) return; this.splits.push(null); this.emit('skip'); }
  undo() { if (!this.splits.length) return; this.splits.pop(); if (this.phase === 'done') this.phase = 'running'; this.emit('undo'); }
  pause() {
    if (this.phase === 'running') { this.phase = 'paused'; this.pausedAt = performance.now(); }
    else if (this.phase === 'paused') { this.pausedTotal += performance.now() - this.pausedAt; this.phase = 'running'; }
    this.emit('pause');
  }
  emit(type) { this.onChange && this.onChange(type, this); }
}

// Segment durations from cumulative splits (null-safe for skipped splits).
export function segmentsOf(splits) {
  return splits.map((s, k) => {
    const prev = k ? splits[k - 1] : 0;
    return s == null || prev == null ? null : s - prev;
  });
}

// Fold a finished or reset attempt into the stored timer record.
export function recordAttempt(rec, splits, { done, at = Date.now() }) {
  const segs = segmentsOf(splits);
  const golds = [];
  segs.forEach((s, k) => {
    if (s == null || s <= 0) return;
    if (rec.best[k] == null || s < rec.best[k]) { rec.best[k] = s; golds.push(k); }
  });
  const time = done ? splits[splits.length - 1] : null;
  const isPB = done && (!rec.pb || time < rec.pb.time);
  if (isPB) rec.pb = { splits: splits.slice(), time, at };
  rec.attempts.push({ at, splits: splits.slice(), time, done });
  if (done) rec.runs = (rec.runs || 0) + 1; else rec.resets = (rec.resets || 0) + 1;
  return { golds, isPB };
}

export const sumOfBest = best => (best.length && best.every(x => x != null) ? best.reduce((a, b) => a + b, 0) : null);
