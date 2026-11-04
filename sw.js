// Service worker: offline app shell, patch-note refresh in the background,
// notifications when a new patch touches the raid or movement.
const VERSION = 'v13';
const SHELL = `shell-${VERSION}`;
const DATA = 'data-v1';
const REMOTE = 'https://raw.githubusercontent.com/DrThomasAger/dragonwilds-speedrun/main/data/patchnotes.json';
const ASSETS = [
  './', 'index.html', 'hardcore-run.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/lib/util.js', 'js/lib/store.js', 'js/lib/player.js', 'js/lib/reel.js', 'js/lib/sync.js', 'js/lib/ui.js',
  'js/lib/timer.js', 'js/lib/lss.js', 'js/lib/src.js', 'js/lib/patches.js', 'js/lib/pwa.js', 'js/lib/palette.js', 'js/lib/bridge.js', 'js/lib/speak.js',
  'js/lib/kb-data.js', 'js/lib/kb-graph.js', 'js/lib/kb-chart.js', 'js/views/kb.js', 'css/kb.css', 'css/aero.css', 'css/aero-app.css', 'css/blog-template.css', 'css/blog-aero.css', 'js/views/blog.js', 'content/blog/ghost-import.json',
  'js/data/videos.js', 'js/data/raid.js', 'js/data/route.js', 'js/data/hardcore.js', 'js/data/wiki.js',
  'js/views/start.js', 'js/views/hq.js', 'js/views/today.js', 'js/views/run.js', 'js/views/compare.js', 'js/views/route.js', 'js/views/studio.js', 'js/views/practice.js', 'js/views/timer.js',
  'js/views/library.js', 'js/views/hardcore.js', 'js/views/patches.js', 'js/views/wiki.js',
  'data/patchnotes.json', 'data/sources.json', 'data/kb/pages.json', 'data/kb/graph.json', 'data/kb/daily.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Same-origin: network first (updates land immediately), cache as offline fallback.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.href.startsWith(REMOTE)) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(DATA).then(c => c.put(REMOTE, copy)); return r; })
      .catch(() => caches.match(REMOTE).then(r => r || caches.match('data/patchnotes.json'))));
    return;
  }
  if (url.origin !== location.origin) return;           // YouTube, speedrun.com: straight to network
  if (url.pathname.includes('/data/kb/agents/')) return; // personal AI metrics (local lab only): never cached
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
});

async function checkPatches() {
  const prev = await caches.match(REMOTE).then(r => (r ? r.json() : null)).catch(() => null);
  const res = await fetch(REMOTE + '?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) return;
  const copy = res.clone();
  const next = await res.json();
  await caches.open(DATA).then(c => c.put(REMOTE, copy));
  if (!prev) return;
  const old = new Set(prev.posts.map(p => p.id));
  const fresh = next.posts.filter(p => !old.has(p.id) && p.lines.some(l => l.raid || l.move));
  if (fresh.length && self.Notification && Notification.permission === 'granted') {
    const p = fresh[0];
    await self.registration.showNotification('Dragonwilds patch: ' + p.title, {
      body: p.lines.filter(l => l.raid || l.move).slice(0, 3).map(l => l.text).join('\n'),
      tag: 'patch-' + p.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './#/patches' },
    });
  }
}
self.addEventListener('periodicsync', e => { if (e.tag === 'patchnotes') e.waitUntil(checkPatches()); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'refresh-patches') e.waitUntil(checkPatches().catch(() => {})); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    const url = (e.notification.data && e.notification.data.url) || './';
    for (const c of cs) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
