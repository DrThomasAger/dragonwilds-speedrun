// Deck = one video surface with a uniform API over either a real YouTube iframe
// player or a deterministic mock (?player=mock) used by the test-suite.
//
// Why extrapolate time: the iframe API only refreshes getCurrentTime() every
// few hundred ms. Cut points, sync and split marks need ~frame precision, so
// while playing we extrapolate from the last reported value with a monotonic clock.

import { BY_ID } from '../data/videos.js';
import { h } from './util.js';

const params = new URLSearchParams(location.search);
export const MOCK = params.get('player') === 'mock';
export const ST = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
export const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

let apiPromise;
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  apiPromise ||= new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
    const s = h('script', { src: 'https://www.youtube.com/iframe_api', async: true });
    s.onerror = () => rej(new Error('YouTube API blocked or offline'));
    document.head.append(s);
    setTimeout(() => rej(new Error('YouTube API timed out')), 20000);
  });
  return apiPromise;
}

// ---------------------------------------------------------------- mock player
// Implements the subset of YT.Player the app uses, with simulated buffering.
class MockPlayer {
  constructor(el, { events }) {
    this.events = events; this.vid = null; this.t = 0; this.at = 0; this.state = ST.UNSTARTED;
    this.rate = 1; this.muted = false; this.timers = [];
    this.el = h('div', { class: 'mock' }, this.label = h('b'), this.clock = h('span'), h('i', {}, this.bar = h('u')));
    el.replaceWith(this.el);
    this.raf = () => { this.paint(); this.frame = requestAnimationFrame(this.raf); };
    this.frame = requestAnimationFrame(this.raf);
    setTimeout(() => events.onReady && events.onReady({ target: this }), 30);
  }
  dur() { return (BY_ID[this.vid] || {}).dur || 600; }
  now() {
    if (this.state !== ST.PLAYING) return this.t;
    const t = this.t + (performance.now() - this.at) / 1000 * this.rate;
    if (t >= this.dur()) { this.t = this.dur(); this.set(ST.ENDED); return this.t; }
    return t;
  }
  set(s) { if (this.state === s) return; this.state = s; this.events.onStateChange && this.events.onStateChange({ target: this, data: s }); }
  later(ms, fn) { const id = setTimeout(fn, ms); this.timers.push(id); }
  clear() { this.timers.forEach(clearTimeout); this.timers = []; }
  startAfter(ms) { this.clear(); this.set(ST.BUFFERING); this.later(ms, () => { this.at = performance.now(); this.set(ST.PLAYING); }); }
  loadVideoById(o, start) {
    const id = typeof o === 'object' ? o.videoId : o; const s = typeof o === 'object' ? o.startSeconds : start;
    this.vid = id; this.t = s || 0; this.startAfter(120);
  }
  cueVideoById(o) { this.clear(); this.vid = o.videoId; this.t = o.startSeconds || 0; this.set(ST.CUED); }
  playVideo() { if (this.state === ST.PLAYING) return; if (this.state === ST.ENDED) this.t = 0; this.startAfter(25); }
  pauseVideo() { this.t = this.now(); this.clear(); this.set(ST.PAUSED); }
  seekTo(t) { const playing = this.state === ST.PLAYING || this.state === ST.BUFFERING; this.t = Math.max(0, Math.min(t, this.dur())); if (playing) this.startAfter(40); else this.paint(); }
  getCurrentTime() { return this.now(); }
  getDuration() { return this.dur(); }
  getPlayerState() { return this.state; }
  setPlaybackRate(r) { this.t = this.now(); this.at = performance.now(); this.rate = r; }
  getPlaybackRate() { return this.rate; }
  mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
  getIframe() { return this.el; }
  destroy() { this.clear(); cancelAnimationFrame(this.frame); this.el.remove(); }
  paint() {
    const v = BY_ID[this.vid]; const t = this.now();
    this.el.style.setProperty('--hue', v ? [...v.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 0);
    this.label.textContent = v ? `${v.author} — ${v.title}` : 'mock player';
    this.clock.textContent = `${this.vid || ''} · ${t.toFixed(2)}s`;
    this.bar.style.width = (100 * t / this.dur()) + '%';
    this.el.dataset.vid = this.vid || ''; this.el.dataset.t = t.toFixed(3); this.el.dataset.state = this.state;
  }
}

// ---------------------------------------------------------------- deck
let deckSeq = 0;
export class Deck {
  constructor(host, { controls = false, label = '' } = {}) {
    this.n = ++deckSeq;
    this.el = h('div', { class: 'deck', dataset: { deck: this.n } });
    const mount = h('div');
    this.el.append(mount);
    if (label) this.el.append(this.tag = h('div', { class: 'deck-tag' }, label));
    host.append(this.el);
    this.state = ST.UNSTARTED; this.vid = null; this.rate = 1; this.listeners = new Set();
    this._raw = 0; this._rawAt = 0;
    this.ready = new Promise((res, rej) => {
      const events = {
        onReady: () => { this.isReady = true; res(this); },
        onStateChange: e => this._state(e.data),
        onError: e => this._emit('error', e.data),
      };
      if (MOCK) { this.p = new MockPlayer(mount, { events }); return; }
      loadYouTubeAPI().then(YT => {
        this.p = new YT.Player(mount, {
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, controls: controls ? 1 : 0, disablekb: 1, fs: 1, origin: location.origin },
          events,
        });
      }).catch(rej);
    });
    (window.__decks ||= []).push(this);
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(type, data) { this.listeners.forEach(f => f(type, data, this)); }
  _state(s) {
    // YouTube starts playback when seeking a cued/unstarted video; honour a paused scrub.
    if (s === ST.PLAYING && this._pauseOnPlay) { this._pauseOnPlay = false; this.p.pauseVideo(); }
    // re-anchor extrapolation whenever playback (re)starts
    if (s === ST.PLAYING) { this._raw = this.p.getCurrentTime() || 0; this._rawAt = performance.now(); }
    this.state = s; this.el.dataset.state = s; this._emit('state', s);
    if (this._waiters) this._waiters = this._waiters.filter(w => !w(s));
  }
  waitState(pred, ms = 8000) {
    return new Promise(res => {
      if (pred(this.state)) return res(true);
      const w = s => { if (pred(s)) { res(true); return true; } return false; };
      (this._waiters ||= []).push(w);
      setTimeout(() => { this._waiters = (this._waiters || []).filter(x => x !== w); res(false); }, ms);
    });
  }
  get playing() { return this.state === ST.PLAYING; }
  time() {
    if (!this.p || !this.p.getCurrentTime) return 0;
    const raw = this.p.getCurrentTime() || 0;
    const now = performance.now();
    if (raw !== this._raw) { this._raw = raw; this._rawAt = now; }
    if (this.state !== ST.PLAYING || MOCK) return raw;
    return raw + Math.min(1, (now - this._rawAt) / 1000 * this.rate);
  }
  duration() { return (BY_ID[this.vid] || {}).dur || (this.p && this.p.getDuration && this.p.getDuration()) || 0; }

  // Load and play from `start`.
  async load(vid, start = 0, { play = true, muted = false } = {}) {
    await this.ready;
    this.primed = null; this._pauseOnPlay = false;
    muted || this.muteLock ? this.p.mute() : this.p.unMute();
    this.vid = vid; this.el.dataset.vid = vid;
    if (play) this.p.loadVideoById({ videoId: vid, startSeconds: start });
    else this.p.cueVideoById({ videoId: vid, startSeconds: start });
    this._raw = start; this._rawAt = performance.now();
    this.p.setPlaybackRate(this.rate);
    // YouTube can swallow a load that lands on top of an in-flight cue; nudge it.
    if (play) {
      const token = this.loadToken = {};
      setTimeout(() => { if (this.loadToken === token && this.vid === vid && (this.state === ST.CUED || this.state === ST.UNSTARTED)) this.p.playVideo(); }, 1500);
    }
  }
  // Buffer `vid` at `start` and hold it paused (muted) so a later play() starts instantly.
  async prime(vid, start) {
    await this.ready;
    const token = this.primeToken = {};
    this._pauseOnPlay = false;
    this.p.mute();
    this.vid = vid; this.el.dataset.vid = vid;
    this.p.loadVideoById({ videoId: vid, startSeconds: start });
    await this.waitState(s => s === ST.PLAYING, 10000);
    if (this.primeToken !== token) return false;
    this.p.pauseVideo(); this.p.seekTo(start, true);
    this._raw = start; this._rawAt = performance.now();
    this.primed = { vid, start };
    return true;
  }
  isPrimed(vid, start) { return this.primed && this.primed.vid === vid && Math.abs(this.primed.start - start) < 0.05; }
  play() { this._pauseOnPlay = false; if (this.p && !this.muteLock) this.p.unMute(); this.p && this.p.playVideo(); }
  pause() { this.p && this.p.pauseVideo(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t, exact = true) {
    if (!this.p) return;
    this.primed = null;
    if (this.state === ST.CUED || this.state === ST.UNSTARTED || this.state === ST.PAUSED) this._pauseOnPlay = true;
    this.p.seekTo(Math.max(0, t), exact);
    this._raw = t; this._rawAt = performance.now();
  }
  setRate(r) { this.rate = r; this.p && this.p.setPlaybackRate(r); }
  mute(m = true) { if (!this.p) return; m ? this.p.mute() : this.p.unMute(); }
  show(v = true) { this.el.classList.toggle('off', !v); }
  destroy() {
    this.primeToken = {};
    try { this.p && this.p.destroy(); } catch { /* already gone */ }
    this.el.remove();
    window.__decks = (window.__decks || []).filter(d => d !== this);
  }
}

export const ytUrl = (vid, t = 0) => `https://www.youtube.com/watch?v=${vid}&t=${Math.floor(t)}s`;
export const thumb = vid => `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
