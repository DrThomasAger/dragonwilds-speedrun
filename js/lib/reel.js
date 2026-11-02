// Reel: plays an ordered list of clips {vid, in, out, label} as one continuous
// programme, across any number of different videos, without gaps.
//
// Two decks alternate. While deck A plays clip i, deck B buffers clip i+1 at its
// in-point and holds it paused and muted. At A's out-point B is unpaused and
// revealed in the same frame. Clips edited while playing take effect immediately
// because the cut is evaluated against the live clip object every animation frame.

import { Deck, ST } from './player.js';
import { h } from './util.js';

const LEAD = 0.04;           // start the cut this many seconds before the out-point
const CONTIGUOUS = 0.25;     // same video and next.in within this of out -> just keep playing

export class Reel {
  constructor(host, { onClip, onTime, onEnd, onState } = {}) {
    this.stage = h('div', { class: 'stage' });
    host.append(this.stage);
    this.decks = [new Deck(this.stage), new Deck(this.stage)];
    this.decks[1].show(false);
    this.a = 0; this.clips = []; this.i = -1;
    this.loopReel = false; this.loopClip = false; this.rate = 1;
    this.cb = { onClip, onTime, onEnd, onState };
    this.cuts = [];                  // log of {at, from, to, late} for verification
    this.decks.forEach(d => d.on((type, s, deck) => { if (type === 'state' && deck === this.active) this.cb.onState && this.cb.onState(s); }));
    this.loop = () => { this.tick(); this.raf = requestAnimationFrame(this.loop); };
    this.raf = requestAnimationFrame(this.loop);
    window.__reel = this;
  }
  get active() { return this.decks[this.a]; }
  get standby() { return this.decks[1 - this.a]; }
  get clip() { return this.clips[this.i]; }
  get playing() { return this.active.state === ST.PLAYING || this.active.state === ST.BUFFERING; }

  setClips(clips, { keepPosition = true } = {}) {
    this.clips = clips;
    if (!keepPosition || this.i >= clips.length) this.i = clips.length ? 0 : -1;
    this.primeNext();
  }
  // Call after editing clip boundaries so the standby deck re-buffers the right frame.
  refresh() { this.primeNext(); }

  nextIndex() {
    if (this.loopClip) return this.i;
    if (this.i + 1 < this.clips.length) return this.i + 1;
    return this.loopReel ? 0 : -1;
  }
  contiguous(a, b) { return a && b && a !== b && a.vid === b.vid && Math.abs(b.in - a.out) < CONTIGUOUS; }

  primeNext() {
    const n = this.nextIndex();
    if (n < 0 || n === this.i) return;
    const c = this.clips[n];
    if (this.contiguous(this.clip, c)) return;
    if (!this.standby.isPrimed(c.vid, c.in)) this.standby.prime(c.vid, c.in);
  }

  async playClip(i, offset = 0, { autoplay = true } = {}) {
    const c = this.clips[i];
    if (!c) return;
    const prev = this.i;
    this.i = i;
    const start = c.in + offset;
    if (offset === 0 && this.standby.isPrimed(c.vid, c.in)) this.swap();
    else if (this.active.vid === c.vid && this.active.state !== ST.UNSTARTED) {
      this.active.seek(start);
      if (autoplay) this.active.play(); else this.active.pause();
    } else {
      await this.active.load(c.vid, start, { play: autoplay });
      if (!autoplay) { await this.active.waitState(s => s === ST.CUED || s === ST.PAUSED || s === ST.PLAYING, 3000); }
    }
    this.active.setRate(this.rate);
    if (prev !== i || offset === 0) this.cb.onClip && this.cb.onClip(i, c);
    this.primeNext();
  }

  swap() {
    const next = this.standby, cur = this.active;
    next.setRate(this.rate);
    next.play(); next.primed = null;
    next.show(true); cur.show(false);
    cur.pause();
    this.a = 1 - this.a;
  }

  tick() {
    const c = this.clip;
    if (!c) return;
    const t = this.active.time();
    this.cb.onTime && this.cb.onTime(this.globalTime(t), t, c);
    if (this.active.state !== ST.PLAYING) return;
    if (t < c.out - LEAD) return;
    const n = this.nextIndex();
    const at = performance.now();
    if (n < 0) {
      this.active.pause(); this.active.seek(c.out);
      this.cuts.push({ at, from: this.i, to: -1, t });
      this.cb.onEnd && this.cb.onEnd();
      return;
    }
    const next = this.clips[n];
    this.cuts.push({ at, from: this.i, to: n, t, late: t - c.out });
    if (n === this.i) { this.active.seek(c.in); return; }               // loop this clip
    if (this.contiguous(c, next)) { this.i = n; this.cb.onClip && this.cb.onClip(n, next); this.primeNext(); return; }
    this.playClip(n);
  }

  play() {
    if (this.i < 0) return this.playClip(0);
    const c = this.clip, t = this.active.time();
    if (this.active.state === ST.UNSTARTED || this.active.vid !== c.vid) return this.playClip(this.i);
    if (t >= c.out - LEAD || t < c.in - 0.5) this.active.seek(c.in);
    this.active.play();
  }
  pause() { this.active.pause(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  setRate(r) { this.rate = r; this.decks.forEach(d => d.setRate(r)); }

  // Seek within the current video (used by the editor while scrubbing a handle).
  scrub(t, exact = false) {
    const c = this.clip;
    if (!c) return;
    if (this.active.vid !== c.vid) { this.active.load(c.vid, t, { play: false }); return; }
    this.active.seek(t, exact);
  }

  lengths() { return this.clips.map(c => Math.max(0, c.out - c.in)); }
  totalLength() { return this.lengths().reduce((a, b) => a + b, 0); }
  globalTime(t = this.active.time()) {
    const L = this.lengths();
    let g = 0;
    for (let k = 0; k < this.i; k++) g += L[k];
    const c = this.clip;
    return c ? g + Math.min(Math.max(t - c.in, 0), L[this.i]) : 0;
  }
  locate(G) {
    const L = this.lengths();
    let acc = 0;
    for (let k = 0; k < L.length; k++) { if (G < acc + L[k] || k === L.length - 1) return { i: k, offset: Math.min(Math.max(0, G - acc), L[k]) }; acc += L[k]; }
    return { i: 0, offset: 0 };
  }
  seekGlobal(G) {
    const { i, offset } = this.locate(G);
    const wasPlaying = this.playing;
    if (i === this.i && this.active.vid === this.clips[i].vid) { this.active.seek(this.clips[i].in + offset); return; }
    this.playClip(i, offset, { autoplay: wasPlaying });
  }

  destroy() { cancelAnimationFrame(this.raf); this.decks.forEach(d => d.destroy()); this.stage.remove(); if (window.__reel === this) window.__reel = null; }
}
