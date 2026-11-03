// Review queue: every raid run / video the lab knows about, plus YouTube searches for
// full raid runs of any time. Sources:
//   data/sources.json                         (tracker: speedrun.com runs + YouTube videos)
//   data/kb/raw/speedrun/runs.json            (all statuses incl. rejected)
//   data/kb/raw/youtube/*.json, _discovered.json (ingest cache + its search hits)
//   D:\claude-temp\register\raid-sources.json (hand-kept register; optional)
//   YouTube search (yt-dlp ytsearch), cached in data/kb/reviews/_search.json
// Reviewed ids are kept in data/kb/reviews/_state.json; the queue skips them unless the
// requested review level is higher than the one recorded (light → full).
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ROOT, OUT, YTDLP, run, readJson, writeJson, ytId, now, VALID_ID, isBotBlock, backedOff } from './lib.mjs';

export const RAID = /kuldra|scorned|wilderness|\braid\b/i;
const FULLRUN = /full (raid )?run|whole raid|speed ?run|\bno commentary\b|\b\d{1,2}:\d\d\b|\b\d{1,2} ?min|\bwr\b|world record|\bpb\b|\bsolo\b|\bduo\b|\bfirst (clear|kill)|blind|completion|\brun\b/i;
const OFFTOPIC = /patch notes|podcast|construction|wasting hours|combat just changed|before .*1\.0|farm|residue|safespot|tier list|reaction/i;
export const SEARCHES = [
  'scorned wilderness full run', 'kuldra raid full run', 'dragonwilds raid no commentary', 'dragonwilds raid full run',
  'scorned wilderness raid', 'kuldra speedrun', 'dragonwilds kuldra first kill', 'scorned wilderness solo', 'kuldra raid solo',
  'dragonwilds raid speedrun', 'kuldra raid gameplay', 'scorned wilderness walkthrough', 'dragonwilds kuldra skip', 'kuldra raid 1.0.1.2',
];
export const LEVELS = { light: 1, full: 2 };

export const statePath = () => path.join(OUT, '_state.json');
export async function loadState() { return readJson(statePath(), { version: 1, ids: {} }); }
export async function saveState(s) { await writeJson(statePath(), s); }

// speedrun.com rank within bracket (best verified time per player); null if not verified.
function ranks(runs) {
  const by = {};
  for (const r of runs.filter(r => r.status === 'verified')) (by[r.bracket] ||= []).push(r);
  const out = {};
  for (const list of Object.values(by)) {
    const best = new Map();
    for (const r of list.sort((a, b) => a.time - b.time)) { const p = r.players.join('&'); if (!best.has(p)) best.set(p, r); }
    [...best.values()].forEach((r, i) => { out[r.id] = i + 1; });
  }
  return out;
}

export async function searchYoutube(queries = SEARCHES, { per = 20, maxAgeH = 20, cacheFile = path.join(OUT, '_search.json') } = {}) {
  const cache = await readJson(cacheFile, { at: null, queries: {}, hits: {} });
  const fresh = cache.at && Date.now() - Date.parse(cache.at) < maxAgeH * 3600e3;
  if (fresh) return cache;
  for (const q of queries) {
    const r = await run(YTDLP, ['--flat-playlist', '-J', '--no-warnings', '--js-runtimes', 'node', `ytsearch${per}:${q}`], { timeout: 120000 });
    if (r.code !== 0 || !r.stdout.trim().startsWith('{')) { cache.queries[q] = { at: now(), error: r.stderr.slice(-200) }; continue; }
    const j = JSON.parse(r.stdout);
    const ids = [];
    for (const e of j.entries || []) {
      if (!e.id || !VALID_ID.test(e.id)) continue;
      ids.push(e.id);
      const h = cache.hits[e.id] || { id: e.id, firstSeen: now(), queries: [] };
      Object.assign(h, { title: e.title, author: e.channel || e.uploader, duration: e.duration ?? h.duration ?? null });
      if (!h.queries.includes(q)) h.queries.push(q);
      cache.hits[e.id] = h;
    }
    cache.queries[q] = { at: now(), n: ids.length };
  }
  cache.at = now();
  await writeJson(cacheFile, cache);
  return cache;
}

export async function buildQueue({ search = true, registerFile = process.env.REVIEW_REGISTER || 'D:\\claude-temp\\register\\raid-sources.json' } = {}) {
  const items = new Map();
  const add = (id, o) => {
    if (!id || !VALID_ID.test(id)) return;
    const it = items.get(id) || { id, url: `https://www.youtube.com/watch?v=${id}`, from: [], title: null, author: null };
    for (const [k, v] of Object.entries(o)) if (k !== 'from' && v != null && it[k] == null) it[k] = v;
    if (o.from && !it.from.includes(o.from)) it.from.push(o.from);
    if (o.run) it.run = { ...(it.run || {}), ...o.run };
    items.set(id, it);
  };

  // speedrun.com — every status
  const runs = await readJson(path.join(ROOT, 'data', 'kb', 'raw', 'speedrun', 'runs.json'), { runs: [] });
  const rk = ranks(runs.runs);
  for (const r of runs.runs) for (const u of r.videos || []) {
    add(ytId(u), { from: 'speedrun.com', author: r.players.join(' & '), kind: 'run', run: { src: r.id, status: r.status, rank: rk[r.id] ?? null, time: r.time, bracket: r.bracket, players: r.players, examinerNote: r.examinerNote || null, comment: r.comment || null, date: r.date } });
  }
  // tracker
  const src = await readJson(path.join(ROOT, 'data', 'sources.json'), { items: {} });
  for (const it of Object.values(src.items || {})) {
    if (it.kind === 'run') add(ytId(it.video), { from: 'sources.json', kind: 'run', run: { src: it.key.slice(4), status: it.status, time: it.time, bracket: it.bracket } });
    else if (it.kind === 'video' && RAID.test(it.title || '')) add(it.key.slice(3), { from: 'sources.json', title: it.title, runTime: it.time ?? null });
  }
  // ingest cache
  const ydir = path.join(ROOT, 'data', 'kb', 'raw', 'youtube');
  let files = [];
  try { files = await readdir(ydir); } catch {}
  for (const f of files.filter(f => /^[\w-]{11}\.json$/.test(f))) {
    const d = await readJson(path.join(ydir, f), null);
    if (d && RAID.test(`${d.title} ${d.description?.slice(0, 300)}`)) add(d.id, { from: 'kb/raw/youtube', title: d.title, author: d.author, duration: d.duration, date: d.date });
  }
  const disc = await readJson(path.join(ydir, '_discovered.json'), {});
  for (const d of Object.values(disc)) if (RAID.test(d.title || '')) add(d.id, { from: 'kb/raw/youtube/_discovered', title: d.title, author: d.author });
  // register
  const reg = await readJson(registerFile, []);
  for (const x of Array.isArray(reg) ? reg : []) { const id = ytId(x.url); if (id) add(id, { from: 'register', title: x.title, author: x.author, runTime: x.time_s ?? null, regType: x.type }); }
  // YouTube search
  if (search) {
    const s = await searchYoutube();
    for (const h of Object.values(s.hits || {})) if (RAID.test(h.title || '')) add(h.id, { from: 'youtube-search', title: h.title, author: h.author, duration: h.duration });
  }

  let reference = new Set();
  try { const { RUNS } = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'raid.js')).href); reference = new Set(RUNS.map(r => r.vid)); } catch {}
  for (const it of items.values()) {
    it.reference = reference.has(it.id);
    it.kind ||= FULLRUN.test(it.title || '') && !/guide|explained|how to|tutorial/i.test(it.title || '') ? 'run' : (/guide|explained|how to|tutorial/i.test(it.title || '') ? 'guide' : 'video');
    it.priority = priority(it);
  }
  return [...items.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function priority(it) {
  let p = 30;
  const t = it.title || '';
  if (it.run) p = it.run.status === 'verified' ? (it.run.rank && it.run.rank <= 2 ? 60 : 75) : 90; // rejected/new first
  else if (it.kind === 'run') p = 80;                       // unranked full runs from YouTube
  else if (it.kind === 'guide') p = 40;
  if (it.reference) p = Math.min(p, 55);
  if (OFFTOPIC.test(t)) p -= 25;
  if (it.duration && it.duration > 45 * 60) p -= 20;
  if (it.duration && it.duration < 90) p -= 10;
  return p;
}

// Items still to review at `level` (state records the level each id reached).
export function pending(queue, state, level = 'full', { force = false, at = Date.now() } = {}) {
  return queue.filter(it => {
    if (force) return true;
    const s = state.ids?.[it.id];
    if (!s) return true;
    if (s.status === 'unavailable' || s.status === 'invalid') return false;
    // YouTube bot check: wait out the back-off, then retry (never counted as a failed attempt)
    if (backedOff(s, at)) return false;
    if (s.status === 'deferred') return true;
    if (s.status === 'error' && isBotBlock(s.lastError)) return true;
    if (s.status === 'error') return (s.attempts || 0) < 3;
    if (s.transcriptRetry && (s.transcriptAttempts || 0) < 3) { it.transcriptRetry = true; return true; }
    return (LEVELS[s.level] || 0) < LEVELS[level];
  });
}
