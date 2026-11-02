// Official patch notes with raid / movement lines flagged, refreshed live.
import { h, isTyping, fill } from '../lib/util.js';
import * as patches from '../lib/patches.js';

export const title = 'Patch notes';
export const keys = [['/', 'Search'], ['F', 'Cycle filter']];

const FILTERS = [['raid', 'Raid & movement'], ['patch', 'All patches'], ['all', 'Everything']];

export function mount(root, { params }) {
  let filter = params.f || 'raid', q = '';
  const status = h('span', { class: 'note' }, 'Loading…');
  const tabs = h('div', { class: 'seg-ctl', role: 'group', 'aria-label': 'Filter' });
  const search = h('input', { type: 'search', placeholder: 'Search patch notes…', 'aria-label': 'Search patch notes', style: { flex: 1, minWidth: '180px' }, oninput: () => { q = search.value.toLowerCase(); paint(); } });
  const banner = h('div');
  const list = h('div', { class: 'grid' });
  const notifyBtn = h('button', { class: 'btn sm', onclick: async () => { const r = await patches.enableNotifications(); notifyBtn.textContent = r === 'granted' ? '🔔 Alerts on' : r === 'unsupported' ? 'Alerts unsupported here' : 'Alerts blocked'; } },
    typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '🔔 Alerts on' : '🔔 Alert me on new raid patches');
  root.append(
    h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Patch notes'),
      h('p', {}, 'Official Jagex announcements from Steam, checked when the app opens, every hour while it is open, and whenever you come back to it. Lines that touch the raid or movement are flagged — any of them can break or create a skip.'))),
    h('div', { class: 'row', style: { marginBottom: '10px' } }, tabs, search),
    h('div', { class: 'row', style: { marginBottom: '12px' } }, status, h('span', { class: 'spacer' }), notifyBtn, h('button', { class: 'btn sm', onclick: () => { status.textContent = 'Checking…'; patches.refresh({ force: true }); } }, '⟳ Check now')),
    banner, list);

  let fresh = [];
  function paint() {
    const d = patches.get();
    fill(tabs, ...FILTERS.map(([k, l]) => h('button', { class: k === filter ? 'on' : '', onclick: () => { filter = k; paint(); } }, l)));
    if (!d) return;
    status.textContent = `${d.posts.length} posts · source ${d.source === 'github' ? 'live mirror' : 'bundled copy'} · mirrored ${new Date(d.fetchedAt).toLocaleString()} · checked ${new Date(d.checkedAt).toLocaleTimeString()}`;
    const latest = patches.latestPatch();
    fill(banner, latest && patches.cmpVersion(latest.version, patches.ROUTE_VERIFIED_ON) > 0
      ? h('div', { class: 'callout', style: { marginBottom: '12px' } }, h('b', {}, `Patch ${latest.version} is newer than the route (verified on ${patches.ROUTE_VERIFIED_ON}).`), ' Check every skip before trusting it.')
      : h('div', { class: 'callout good', style: { marginBottom: '12px' } }, `The route is verified on the latest patch (${patches.ROUTE_VERIFIED_ON}).`));
    const freshIds = new Set(fresh.map(p => p.id));
    const posts = d.posts.filter(p => filter === 'all' || (filter === 'patch' ? p.patch : p.lines.some(l => l.raid || l.move)))
      .filter(p => !q || p.title.toLowerCase().includes(q) || p.lines.some(l => l.text.toLowerCase().includes(q)));
    fill(list, ...(posts.length ? posts.map(p => {
      const hot = p.lines.filter(l => l.raid || l.move);
      const shown = filter === 'all' || q ? p.lines.filter(l => !q || l.text.toLowerCase().includes(q) || l.raid || l.move) : hot;
      return h('article', { class: 'card patch' },
        h('div', { class: 'row' }, h('time', { class: 'mono note' }, p.date), p.version ? h('span', { class: 'pill' }, p.version) : null,
          freshIds.has(p.id) ? h('span', { class: 'pill new' }, 'new') : null, hot.length ? h('span', { class: 'pill warn' }, `${hot.length} raid/movement`) : null,
          h('span', { class: 'spacer' }), h('a', { class: 'btn xs', href: p.url, target: '_blank', rel: 'noopener' }, 'Steam ↗')),
        h('h3', { style: { margin: '8px 0' } }, p.title),
        shown.length ? h('ul', { class: 'plines' }, shown.slice(0, 60).map(l => h('li', { class: l.raid ? 'raid' : l.move ? 'move' : '' }, l.raid ? h('span', { class: 'pill dead' }, 'raid') : l.move ? h('span', { class: 'pill new' }, 'move') : null, ' ', l.text))) : null,
        p.lines.length > shown.length ? h('details', {}, h('summary', { class: 'note' }, `All ${p.lines.length} lines`), h('ul', { class: 'plines' }, p.lines.map(l => h('li', {}, l.text)))) : null);
    }) : [h('div', { class: 'empty' }, 'Nothing matches.')]));
  }
  const unsub = patches.subscribe((d, f) => { fresh = f; paint(); });
  patches.refresh();
  const t = setTimeout(() => patches.markSeen(), 4000);   // seen once you have looked for a moment
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); search.focus(); }
    else if (e.key === 'f' || e.key === 'F') { filter = FILTERS[(FILTERS.findIndex(x => x[0] === filter) + 1) % FILTERS.length][0]; paint(); }
  };
  document.addEventListener('keydown', onKey);
  paint();
  return () => { unsub(); clearTimeout(t); document.removeEventListener('keydown', onKey); };
}
