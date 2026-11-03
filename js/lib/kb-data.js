// Knowledge base data, kept fresh while the app is in use (same pattern as patches.js).
//
// scripts/build-kb.mjs compiles every source into data/kb/{pages,graph,daily}.json and the
// hourly GitHub Action commits them. The app shows the bundled copy at once, then pulls
// the live copy from GitHub (CORS-enabled) on open, every hour while open and whenever it
// comes back to the foreground, keeping whichever build is newer. When the app is served
// by the local bridge (`bb lab`), live feed events stream in from /api/events too.

const REMOTE = 'https://raw.githubusercontent.com/DrThomasAger/dragonwilds-speedrun/main/data/kb/';
const LOCAL = 'data/kb/';
const HOUR = 60 * 60 * 1000;

let data = null, lastFetch = 0, inflight = null, started = false;
const subs = new Set();
const live = { on: false, events: [] };
const liveSubs = new Set();

export const get = () => data;
export const subscribe = f => { subs.add(f); if (data) f(data); return () => subs.delete(f); };
export const liveFeed = () => live;
export const subscribeLive = f => { liveSubs.add(f); f(live); return () => liveSubs.delete(f); };

async function pull(base, name) {
  const url = base + name + '.json';
  const r = await fetch(url + (url.startsWith('http') ? `?t=${Date.now()}` : ''), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function pullAll(base) {
  const [pages, graph, daily] = await Promise.all(['pages', 'graph', 'daily'].map(n => pull(base, n)));
  return { pages, graph, daily };
}

// Indexes the views need: id -> page, type -> pages.
function index(d, source) {
  const byId = new Map(d.pages.pages.map(p => [p.id, p]));
  const byType = new Map();
  for (const p of d.pages.pages) { if (!byType.has(p.type)) byType.set(p.type, []); byType.get(p.type).push(p); }
  return { ...d, byId, byType, generated: d.pages.generated, source, checkedAt: new Date().toISOString() };
}
const publish = () => subs.forEach(f => f(data));

export function refresh({ force = false } = {}) {
  if (!force && data && Date.now() - lastFetch < 5 * 60 * 1000) return Promise.resolve(data);
  inflight ||= (async () => {
    if (!data) { try { data = index(await pullAll(LOCAL), 'bundled'); publish(); } catch { /* not built yet */ } }
    let d = null;
    try { d = await pullAll(REMOTE); } catch { /* offline, or not published yet */ }
    inflight = null;
    lastFetch = Date.now();
    if (d && (!data || d.pages.generated > data.generated)) { data = index(d, 'github'); publish(); }
    else if (data) { data.checkedAt = new Date().toISOString(); publish(); }
    return data;
  })();
  return inflight;
}

export function start() {
  if (started) return refresh();
  started = true;
  setInterval(() => refresh({ force: true }), HOUR);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('focus', () => refresh());
  window.addEventListener('online', () => refresh({ force: true }));
  connectBridge();
  return refresh({ force: true });
}

// Local bridge only: feed events (splits, PBs, practice, game snapshots) as they happen.
async function connectBridge() {
  if (/\.github\.io$/.test(location.hostname)) return; // public site: no bridge, skip the 404 probe
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) return;
    const st = await r.json();
    if (!st.bridge) return;
  } catch { return; }
  live.on = true;
  const es = new EventSource('api/events');
  const push = ev => { if (!ev) return; live.events.unshift(ev); live.events.length = Math.min(live.events.length, 300); };
  es.onmessage = m => {
    let d; try { d = JSON.parse(m.data); } catch { return; }
    if (d.type === 'hello') { live.events = []; (d.events || []).forEach(push); }
    else if (d.type === 'feed') push(d.event);
    else return;
    liveSubs.forEach(f => f(live));
  };
  liveSubs.forEach(f => f(live));
}
