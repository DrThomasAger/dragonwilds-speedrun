// Shared UI components: clip timeline editor, generic scrubber, reel player panel.
import { h, fmtClock, fmtRun, clamp, parseTime } from './util.js';
import { RATES, ytUrl, thumb } from './player.js';
import { Reel } from './reel.js';
import { BY_ID } from '../data/videos.js';

// ------------------------------------------------------------------ Timeline
// Edits one clip {in, out} on a video of `duration` seconds. Dragging a handle
// calls onScrub(t) continuously (the caller seeks the video so the frame under
// the handle is visible live) and onChange({in,out}) on every move.
export function timeline({ duration, clip, chapters = [], onScrub, onChange, onCommit, onSeek }) {
  let view = { a: 0, b: duration }, zoom = false, ph = clip.in;
  const el = h('div', { class: 'tl', role: 'group', 'aria-label': 'Clip timeline' });
  const region = h('div', { class: 'region' });
  const hin = h('div', { class: 'handle in', role: 'slider', tabindex: 0, 'aria-label': 'Clip in point' }, h('b'));
  const hout = h('div', { class: 'handle out', role: 'slider', tabindex: 0, 'aria-label': 'Clip out point' }, h('b'));
  const phEl = h('div', { class: 'ph' });
  const chapEls = h('div');
  const ticks = h('div', { class: 'ticks' });
  el.append(chapEls, region, hin, hout, phEl, ticks);

  const x2t = x => view.a + (x / el.clientWidth) * (view.b - view.a);
  const t2p = t => ((t - view.a) / (view.b - view.a)) * 100;

  function setZoom(z) {
    zoom = z;
    if (z) { const len = clip.out - clip.in; const pad = Math.max(4, len * 0.25); view = { a: Math.max(0, clip.in - pad), b: Math.min(duration, clip.out + pad) }; }
    else view = { a: 0, b: duration };
    paint();
  }
  function paint() {
    region.style.left = t2p(clip.in) + '%'; region.style.width = (t2p(clip.out) - t2p(clip.in)) + '%';
    hin.style.left = t2p(clip.in) + '%'; hout.style.left = t2p(clip.out) + '%';
    hin.firstChild.textContent = fmtClock(clip.in, true); hout.firstChild.textContent = fmtClock(clip.out, true);
    hin.setAttribute('aria-valuenow', clip.in.toFixed(1)); hout.setAttribute('aria-valuenow', clip.out.toFixed(1));
    phEl.style.left = t2p(ph) + '%';
    phEl.style.display = ph >= view.a && ph <= view.b ? '' : 'none';
    chapEls.replaceChildren(...chapters.filter(([t]) => t >= view.a && t <= view.b).map(([t, l]) => h('div', { class: 'chap', style: { left: t2p(t) + '%' }, title: l }, h('i', {}, l))));
    const span = view.b - view.a, step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(s => span / s <= 10) || 1200;
    const out = [];
    for (let t = Math.ceil(view.a / step) * step; t <= view.b; t += step) out.push(h('span', { style: { left: t2p(t) + '%' } }, fmtClock(t)));
    ticks.replaceChildren(...out);
  }
  function drag(which, e) {
    e.preventDefault(); e.stopPropagation();
    const handle = which === 'in' ? hin : hout;
    handle.classList.add('drag');
    handle.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const move = ev => {
      const t = Math.round(clamp(x2t(ev.clientX - r.left), 0, duration) * 10) / 10;
      if (which === 'in') clip.in = Math.min(t, clip.out - 0.2); else clip.out = Math.max(t, clip.in + 0.2);
      ph = which === 'in' ? clip.in : clip.out;
      paint(); onChange && onChange(clip, which); onScrub && onScrub(ph, false);
    };
    const up = () => { handle.classList.remove('drag'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); onScrub && onScrub(ph, true); onCommit && onCommit(clip, which); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  }
  hin.addEventListener('pointerdown', e => drag('in', e));
  hout.addEventListener('pointerdown', e => drag('out', e));
  el.addEventListener('pointerdown', e => {
    const r = el.getBoundingClientRect();
    ph = clamp(x2t(e.clientX - r.left), 0, duration); paint(); onSeek && onSeek(ph);
  });
  for (const [hd, which] of [[hin, 'in'], [hout, 'out']]) hd.addEventListener('keydown', e => {
    const d = (e.shiftKey ? 1 : 0.1) * (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    nudge(which, d);
  });
  function nudge(which, d) {
    if (which === 'in') clip.in = clamp(Math.round((clip.in + d) * 10) / 10, 0, clip.out - 0.2);
    else clip.out = clamp(Math.round((clip.out + d) * 10) / 10, clip.in + 0.2, duration);
    ph = clip[which]; paint(); onChange && onChange(clip, which); onScrub && onScrub(ph, true); onCommit && onCommit(clip, which);
  }
  new ResizeObserver(paint).observe(el);
  paint();
  return { el, paint, setZoom, get zoom() { return zoom; }, nudge, setPlayhead(t) { ph = t; paint(); }, setClip(c, d = duration) { clip = c; duration = d; setZoom(zoom); } };
}

// Nudge row: [In] −1 −.1 [input] +.1 +1 [= now]   — for precise boundary work.
export function nudgeRow(label, get, set, now) {
  const inp = h('input', { type: 'text', value: fmtClock(get(), true), 'aria-label': label + ' time', onchange: () => { const t = parseTime(inp.value); if (isFinite(t)) set(t); } });
  const b = (txt, d, title) => h('button', { class: 'btn xs', title, onclick: () => set(Math.round((get() + d) * 10) / 10) }, txt);
  const row = h('div', { class: 'nudge' }, h('span', { class: 'lbl' }, label), b('−1', -1, '−1 s'), b('−.1', -0.1, '−0.1 s'), inp, b('+.1', 0.1, '+0.1 s'), b('+1', 1, '+1 s'),
    now && h('button', { class: 'btn xs', title: 'Set to the current video time', onclick: () => set(Math.round(now() * 10) / 10) }, '= now'));
  return { el: row, refresh() { if (document.activeElement !== inp) inp.value = fmtClock(get(), true); } };
}

// ------------------------------------------------------------------ Scrubber
// Generic horizontal scrubber with coloured markers. value/length in seconds.
export function scrubber({ length, onSeek, marks = [], bands = [], label = fmtRun }) {
  const el = h('div', { class: 'scrub', role: 'slider', tabindex: 0, 'aria-label': 'Seek' });
  const fill = h('div', { class: 'fill' }), head = h('div', { class: 'head' }), tip = h('div', { class: 'tip' });
  const markEl = h('div'), bandEl = h('div');
  el.append(h('div', { class: 'rail' }), bandEl, fill, markEl, head, tip);
  let L = length, v = 0, dragging = false;
  const pct = t => (100 * clamp(t, 0, L) / (L || 1)) + '%';
  function paintMarks() {
    markEl.replaceChildren(...marks.map(m => h('div', { class: 'mark', style: { left: pct(m.t), '--c': m.c || 'var(--gold)' }, title: m.title || '' }, m.label ? h('i', {}, m.label) : null)));
    bandEl.replaceChildren(...bands.map(b => h('div', { class: 'seg-band', style: { left: pct(b.a), width: `calc(${pct(b.b)} - ${pct(b.a)})`, background: b.c } })));
  }
  const at = e => { const r = el.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * L; };
  el.addEventListener('pointerdown', e => { dragging = true; el.setPointerCapture(e.pointerId); onSeek(at(e), false); });
  el.addEventListener('pointermove', e => { const t = at(e); tip.style.left = pct(t); tip.textContent = label(t); if (dragging) onSeek(t, false); });
  el.addEventListener('pointerup', e => { if (dragging) onSeek(at(e), true); dragging = false; });
  el.addEventListener('keydown', e => { const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (d) { e.preventDefault(); e.stopPropagation(); onSeek(clamp(v + d * (e.shiftKey ? 10 : 1), 0, L), true); } });
  paintMarks();
  return {
    el,
    set(val) { v = val; fill.style.width = pct(val); head.style.left = pct(val); el.setAttribute('aria-valuenow', val.toFixed(1)); },
    setLength(len) { L = len; paintMarks(); },
    setMarks(m, b = bands) { marks = m; bands = b; paintMarks(); },
  };
}

export function rateSelect(get, set) {
  const s = h('select', { 'aria-label': 'Playback speed', onchange: () => set(parseFloat(s.value)) }, RATES.map(r => h('option', { value: r, selected: r === get() }, r + '×')));
  return s;
}

// ------------------------------------------------------------------ Reel player panel
// A player card (stage + transport + programme bar + now-playing) around a Reel.
// Used by Route, Library and Studio for both single clips and multi-clip reels.
export function reelPlayer(host, { sticky = false, onClip, onTime } = {}) {
  const card = h('div', { class: 'player' + (sticky ? ' sticky' : '') });
  host.append(card);
  const nowbar = h('div', { class: 'nowbar' }, 'Pick a clip to play it here.');
  const tcur = h('b', {}, '0:00'), tlen = h('span', {}, '0:00');
  const bar = h('div', { class: 'reelbar', title: 'Programme — click to seek' });
  const barHead = h('div', { class: 'head' });
  let clips = [], title = '';
  const reel = new Reel(card, {
    onClip: (i, c) => { paintNow(i, c); paintBar(); onClip && onClip(i, c); },
    onTime: (g, t, c) => { tcur.textContent = fmtClock(g, true); const L = reel.totalLength(); barHead.style.left = (100 * g / (L || 1)) + '%'; onTime && onTime(g, t, c); },
    onState: s => { playBtn.textContent = s === 1 || s === 3 ? '❚❚ Pause' : '▶ Play'; },
  });
  const playBtn = h('button', { class: 'btn pri', onclick: () => reel.toggle(), 'aria-label': 'Play or pause' }, '▶ Play');
  const loopClip = h('button', { class: 'btn', title: 'Loop the current clip (L)', onclick: () => { reel.loopClip = !reel.loopClip; loopClip.classList.toggle('on', reel.loopClip); reel.refresh(); } }, '⟲ Clip');
  const loopReel = h('button', { class: 'btn', title: 'Loop the whole programme', onclick: () => { reel.loopReel = !reel.loopReel; loopReel.classList.toggle('on', reel.loopReel); reel.refresh(); } }, '⟲ All');
  const transport = h('div', { class: 'transport' },
    h('button', { class: 'btn', title: 'Previous clip ([)', onclick: () => prev() }, '⏮'),
    playBtn,
    h('button', { class: 'btn', title: 'Next clip (])', onclick: () => next() }, '⏭'),
    h('button', { class: 'btn', title: 'Back 5 s (←)', onclick: () => nudge(-5) }, '−5s'),
    h('button', { class: 'btn', title: 'Forward 5 s (→)', onclick: () => nudge(5) }, '+5s'),
    loopClip, loopReel,
    rateSelect(() => reel.rate, r => reel.setRate(r)),
    h('button', { class: 'btn', title: 'Open on YouTube at this moment', onclick: () => reel.clip && window.open(ytUrl(reel.clip.vid, reel.active.time()), '_blank', 'noopener') }, '↗ YouTube'),
    h('span', { class: 'time' }, tcur, ' / ', tlen));
  bar.addEventListener('click', e => { const r = bar.getBoundingClientRect(); reel.seekGlobal((e.clientX - r.left) / r.width * reel.totalLength()); });
  card.append(transport, bar, nowbar);

  function paintBar() {
    const L = reel.totalLength() || 1;
    bar.replaceChildren(...clips.map((c, i) => h('span', { style: { width: (100 * (c.out - c.in) / L) + '%', background: i === reel.i ? 'var(--accent)' : `hsl(${(i * 47) % 360} 30% 45%)` }, title: c.label }, clips.length < 12 ? String(i + 1) : '')), barHead);
    bar.style.display = clips.length > 1 ? '' : 'none';
    tlen.textContent = fmtClock(L, true);
  }
  function paintNow(i, c) {
    const v = BY_ID[c.vid] || {};
    nowbar.replaceChildren(
      clips.length > 1 ? h('span', { class: 'pill' }, `${i + 1}/${clips.length}`) : null,
      h('b', {}, c.label || v.title),
      h('span', {}, `· ${v.author || ''} · ${fmtClock(c.in, true)} → ${fmtClock(c.out, true)}`),
      title ? h('span', { class: 'spacer' }) : null, title ? h('span', { class: 'note' }, title) : null);
  }
  function prev() { if (reel.i > 0) reel.playClip(reel.i - 1); else if (reel.clip) reel.playClip(0); }
  function next() { if (reel.i < clips.length - 1) reel.playClip(reel.i + 1); }
  function nudge(d) { const c = reel.clip; if (!c) return; reel.active.seek(clamp(reel.active.time() + d, c.in, c.out - 0.1)); }

  return {
    reel, card,
    // Play a single clip or a whole programme starting at index `start`.
    play(list, { start = 0, name = '', autoplay = true } = {}) {
      // Shared by reference: editing a clip object retimes playback immediately.
      clips = list; title = name;
      reel.setClips(clips, { keepPosition: false });
      reel.i = -1;
      paintBar();
      reel.playClip(start, 0, { autoplay });
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    get clips() { return clips; },
    setClips(list) { clips = list; reel.setClips(list); paintBar(); },
    repaint: paintBar,
    key(e) {
      if (e.code === 'Space') { e.preventDefault(); reel.toggle(); return true; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-5); return true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(5); return true; }
      if (e.key === '[') { prev(); return true; }
      if (e.key === ']') { next(); return true; }
      if (e.key === 'l' || e.key === 'L') { loopClip.click(); return true; }
      return false;
    },
    destroy() { reel.destroy(); card.remove(); },
  };
}

export function videoChip(c, onPlay, cur = false) {
  const v = BY_ID[c.vid] || {};
  return h('button', { class: 'chip' + (cur ? ' cur' : ''), onclick: onPlay, title: `${v.author}: ${v.title}` }, '▶ ', c.label, h('small', {}, `${fmtClock(c.in)}–${fmtClock(c.out)}`));
}
export { thumb };
