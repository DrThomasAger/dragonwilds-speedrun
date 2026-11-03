// Official patch notes, kept fresh while the app is in use.
//
// Steam's API has no CORS, so a GitHub Action (hourly) mirrors it into
// data/patchnotes.json. The app pulls that file straight from GitHub (CORS-enabled)
// on open, every hour while open, whenever it comes back to the foreground, and asks
// the service worker to refresh its copy when the app is hidden/closed. On Android
// installs the service worker also checks in the background (periodic sync).

const REMOTE = 'https://raw.githubusercontent.com/DrThomasAger/dragonwilds-speedrun/main/data/patchnotes.json';
const LOCAL = 'data/patchnotes.json';
const SEEN = 'dw_patches_seen';
const HOUR = 60 * 60 * 1000;
export const ROUTE_VERIFIED_ON = '1.0.1.2';

let data = null, lastFetch = 0, inflight = null;
const subs = new Set();

export const get = () => data;
export const subscribe = f => { subs.add(f); if (data) f(data, newPosts()); return () => subs.delete(f); };

function seen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } }
export function newPosts() {
  if (!data) return [];
  const s = seen();
  if (!s.size) return [];                       // first visit: nothing is "new"
  return data.posts.filter(p => !s.has(p.id));
}
export function markSeen() {
  if (!data) return;
  try { localStorage.setItem(SEEN, JSON.stringify(data.posts.map(p => p.id))); } catch { /* storage blocked */ }
  subs.forEach(f => f(data, []));
}

async function pull(url) {
  const r = await fetch(url + (url.startsWith('http') ? `?t=${Date.now()}` : ''), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export function refresh({ force = false } = {}) {
  if (!force && Date.now() - lastFetch < 5 * 60 * 1000 && data) return Promise.resolve(data);
  inflight ||= (async () => {
    // Show the bundled copy at once on first load, then replace it with the live mirror.
    if (!data) { try { const b = await pull(LOCAL); data = { ...b, source: 'bundled', checkedAt: new Date().toISOString() }; subs.forEach(f => f(data, [])); } catch { /* none */ } }
    let d = null, source = 'github';
    try { d = await pull(REMOTE); } catch { try { d = await pull(LOCAL); source = 'bundled'; } catch { /* offline */ } }
    inflight = null;
    if (!d) return data;
    lastFetch = Date.now();
    const first = !localStorage.getItem(SEEN);
    data = { ...d, source, checkedAt: new Date().toISOString() };
    if (first) markSeen();       // baseline on first ever load
    const fresh = newPosts();
    subs.forEach(f => f(data, fresh));
    if (fresh.length) notify(fresh);
    return data;
  })();
  return inflight;
}

function notify(posts) {
  const raid = posts.filter(p => p.lines.some(l => l.raid || l.move));
  if (!raid.length || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const p = raid[0];
  navigator.serviceWorker?.ready.then(reg => reg.showNotification('Dragonwilds patch: ' + p.title, {
    body: p.lines.filter(l => l.raid || l.move).slice(0, 3).map(l => l.text).join('\n'), tag: 'patch-' + p.id, icon: 'icons/icon-192.png', data: { url: './#/patches' },
  })).catch(() => {});
}

export async function enableNotifications() {
  if (typeof Notification === 'undefined') return 'unsupported';
  const r = await Notification.requestPermission();
  if (r === 'granted') {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.periodicSync) await reg.periodicSync.register('patchnotes', { minInterval: HOUR });
    } catch { /* periodic sync needs an installed app on Chromium */ }
  }
  return r;
}

let started = false;
export function start() {
  if (started) return; started = true;
  refresh({ force: true });
  setInterval(() => refresh({ force: true }), HOUR);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
    else navigator.serviceWorker?.controller?.postMessage({ type: 'refresh-patches' });
  });
  window.addEventListener('pagehide', () => navigator.serviceWorker?.controller?.postMessage({ type: 'refresh-patches' }));
  window.addEventListener('online', () => refresh({ force: true }));
}

// Compare dotted versions: 1.0.1.10 > 1.0.1.2
export function cmpVersion(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
export function latestPatch() {
  if (!data) return null;
  return data.posts.filter(p => p.patch && p.version).sort((a, b) => cmpVersion(b.version, a.version))[0] || null;
}
