// Tracks every data source for the raid run and logs what changed.
//   node scripts/track-sources.mjs        (also run hourly by .github/workflows/patchnotes.yml)
// Writes data/sources.json (current state, with firstSeen per item) and appends
// one line per new or changed item to data/sources-log.jsonl.
import { readFile, writeFile, appendFile } from 'node:fs/promises';

const OUT = new URL('../data/sources.json', import.meta.url);
const LOG = new URL('../data/sources-log.jsonl', import.meta.url);
const SRC = 'https://www.speedrun.com/api/v1';
const GAME = '2689lo91', CAT = 'xd19vy4k', VERSION_VAR = 'rn163418', NEW_BRACKET = '1gn0epol';
const RECORD = 410.0;
const QUERIES = ['dragonwilds raid speedrun', 'kuldra speedrun', 'scorned wilderness speedrun', 'dragonwilds kuldra skip', 'dragonwilds 1.0.1.2 raid'];

const now = new Date().toISOString();
const json = async (u, o) => { const r = await fetch(u, { headers: { 'User-Agent': 'dw-raid-lab/1.0', 'Accept-Language': 'en' }, ...o }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const text = async u => { const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.text(); };

async function srcRuns(status) {
  const d = await json(`${SRC}/runs?game=${GAME}&category=${CAT}&status=${status}&orderby=submitted&direction=desc&max=50&embed=players`);
  return d.data.map(r => ({
    key: 'src:' + r.id, kind: 'run', source: 'speedrun.com', status,
    title: `${r.players.data.map(p => p.names?.international || p.name).join(' & ')} ${fmt(r.times.primary_t)}`,
    time: r.times.primary_t, date: r.date, url: r.weblink,
    video: (r.videos?.links || []).map(l => l.uri).find(u => /youtu|twitch/.test(u)) || null,
    bracket: r.values?.[VERSION_VAR] === NEW_BRACKET ? '1.0.0.6+' : 'Pre 1.0.0.6',
  }));
}
async function youtube(q) {
  const h = await text('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=CAI%253D'); // sorted by upload date
  const m = h.match(/var ytInitialData = (\{.*?\});<\/script>/);
  if (!m) return [];
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      out.push({ key: 'yt:' + v.videoId, kind: 'video', source: 'YouTube', title: (v.title?.runs || []).map(r => r.text).join(''),
        author: (v.ownerText?.runs || []).map(r => r.text).join(''), length: v.lengthText?.simpleText || '', published: v.publishedTimeText?.simpleText || '',
        url: 'https://www.youtube.com/watch?v=' + v.videoId });
    }
    for (const k in o) walk(o[k]);
  })(JSON.parse(m[1]));
  return out.filter(v => /dragonwild|kuldra|scorned/i.test(v.title));
}
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
// Pull a run time like "6:42" or "(6:42.5)" out of a title, if any.
const titleTime = t => { const m = t.match(/\b([4-9]):([0-5]\d)(?:\.(\d+))?\b/); return m ? +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0) : null; };

const results = { verified: [], pending: [], videos: [] }, errors = [];
await Promise.all([
  srcRuns('verified').then(x => (results.verified = x)).catch(e => errors.push(String(e))),
  srcRuns('new').then(x => (results.pending = x)).catch(e => errors.push(String(e))),
  ...QUERIES.map(q => youtube(q).then(x => results.videos.push(...x)).catch(e => errors.push(String(e)))),
]);

let prev = { items: {} };
try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
const items = { ...prev.items };
const logLines = [];
for (const it of [...results.verified, ...results.pending, ...results.videos]) {
  if (it.kind === 'video') { const t = titleTime(it.title); if (t) it.time = t; }
  const oldPatch = /patched|legacy|glitch|pre[ -]?1\.0\.0\.6|any%/i.test(it.title);
  it.beatsRecord = it.time != null && it.time < RECORD && !oldPatch && (it.kind === 'video' || it.bracket === '1.0.0.6+');
  const old = items[it.key];
  const changed = !old || old.status !== it.status || old.time !== it.time;
  items[it.key] = { ...it, firstSeen: old?.firstSeen || now, lastSeen: now };
  if (changed) logLines.push(JSON.stringify({ at: now, event: old ? 'changed' : 'new', ...it }));
}
const out = { checkedAt: now, errors, counts: { verified: results.verified.length, pending: results.pending.length, videos: results.videos.length }, items };
await writeFile(OUT, JSON.stringify(out) + '\n');
if (logLines.length) await appendFile(LOG, logLines.join('\n') + '\n');
const beat = Object.values(items).filter(i => i.beatsRecord);
console.log(`sources: ${results.verified.length} verified, ${results.pending.length} pending, ${results.videos.length} videos; ${logLines.length} new/changed; ${errors.length} errors`);
if (beat.length) console.log('UNDER 6:50:', beat.map(b => `${b.title} (${b.url})`).join(' | '));
