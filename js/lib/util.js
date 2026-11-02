// DOM + time helpers shared by every view.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (typeof v === 'boolean' || (k in el && typeof v !== 'string')) el[k] = v;
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Run time: 81.37 -> "1:21.37"; digits = decimals shown.
export function fmtRun(s, digits = 2) {
  if (s == null || !isFinite(s)) return '—';
  const neg = s < 0; s = Math.abs(s);
  const f = 10 ** digits;
  let total = Math.floor(s * f + 1e-6) / f;
  const m = Math.floor(total / 60), r = total - m * 60;
  const sec = digits ? r.toFixed(digits).padStart(3 + digits, '0') : String(Math.floor(r)).padStart(2, '0');
  const hh = Math.floor(m / 60);
  const body = hh ? `${hh}:${String(m % 60).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  return (neg ? '−' : '') + body;
}

// Delta: +3.2 / −1.5 / +1:02.3
export function fmtDelta(s, digits = 1) {
  if (s == null || !isFinite(s)) return '—';
  const sign = s > 0 ? '+' : s < 0 ? '−' : '±';
  const a = Math.abs(s);
  return sign + (a >= 60 ? fmtRun(a, digits) : a.toFixed(digits));
}

// Video clock: 75.4 -> "1:15", or with tenths "1:15.4"
export function fmtClock(s, tenths = false) {
  if (s == null || !isFinite(s)) return '—';
  s = Math.max(0, s);
  const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const sec = tenths ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0');
  return hh ? `${hh}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// "1:21.37" | "81.37" | "0:01:21" -> seconds (NaN when unparseable)
export function parseTime(str) {
  if (typeof str === 'number') return str;
  const s = String(str || '').trim().replace(',', '.');
  if (!s) return NaN;
  if (!/^[\d:.]+$/.test(s)) return NaN;
  return s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p || '0'), 0);
}

export const uid = () => Math.random().toString(36).slice(2, 9);

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function pickFile(accept) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.addEventListener('change', async () => { const f = i.files[0]; res(f ? { name: f.name, text: await f.text() } : null); i.remove(); });
    document.body.append(i); i.click();
  });
}

let toastTimer;
export function toast(msg, kind = '') {
  let el = $('#toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.className = 'show ' + kind; el.textContent = msg;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = ''), 2600);
}

export const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

// URL-safe base64 for share links.
export const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const dec = str => JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))));
