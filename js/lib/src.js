// speedrun.com live leaderboard for the Raid category (the API allows CORS).
// Falls back to the snapshot bundled in data/raid.js when offline.

import { SRC, SRC_SNAPSHOT } from '../data/raid.js';
import * as store from './store.js';

const API = 'https://www.speedrun.com/api/v1';
const TTL = 20 * 60 * 1000;

export async function leaderboard({ force = false } = {}) {
  const cache = store.get().src;
  if (!force && cache && Date.now() - cache.at < TTL) return { ...cache, source: 'cache' };
  try {
    const q = `${API}/leaderboards/${SRC.game}/category/${SRC.category}?var-${SRC.versionVar}=${SRC.versionNew}&embed=players&top=25`;
    const res = await fetch(q, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = (await res.json()).data;
    const players = Object.fromEntries(d.players.data.map(p => [p.id, (p.names && p.names.international) || p.name]));
    const rows = d.runs.map(r => ({
      place: r.place, id: r.run.id, t: r.run.times.primary_t, date: r.run.date,
      players: r.run.players.map(p => players[p.id] || p.name || '?'),
      video: ((r.run.videos && r.run.videos.links) || []).map(l => l.uri).find(u => /youtu|twitch/.test(u)) || null,
      link: r.run.weblink,
    }));
    const out = { at: Date.now(), rows };
    store.update(s => (s.src = out));
    return { ...out, source: 'live' };
  } catch (err) {
    if (cache) return { ...cache, source: 'cache', error: String(err.message || err) };
    return { at: Date.parse(SRC_SNAPSHOT.at), rows: SRC_SNAPSHOT.rows, source: 'snapshot', error: String(err.message || err) };
  }
}
