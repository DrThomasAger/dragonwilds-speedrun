// YouTube: transcripts (top priority), metadata, chapters and top comments for every
// Dragonwilds raid / Kuldra / Scorned Wilderness, movement-tech, speedrun, boss-guide
// and patch-notes video we can find.
//   node scripts/ingest/youtube.mjs [--max=N] [--only=<id,id>] [--refresh] [--no-discover] [--no-comments] [--yt-whisper]
//   --yt-whisper (local): transcribe videos YouTube has no captions for with faster-whisper
//
// Video set (all merged, de-duplicated):
//   - every video in js/data/videos.js
//   - every video in data/sources.json (scripts/track-sources.mjs) + YouTube links on its runs
//   - YouTube links on speedrun.com runs (data/kb/raw/speedrun/runs.json)
//   - INGEST_EXTRA_SOURCES json lists (default D:\claude-temp\register\raid-sources.json if present)
//   - fresh YouTube searches (relevance + newest; incl. low-ranked full / commentary runs),
//     remembered in data/kb/raw/youtube/_discovered.json
//
// Two phases per run, so transcripts land first:
//   1. transcripts: yt-dlp -J (no comments) for each video without a transcript, then the
//      json3 captions (manual subs first, else auto-subs) with backoff on 429. A 429 run
//      stops cleanly and resumes next time (state in _state.json).
//   2. comments: yt-dlp -J --write-comments (cap 200 per video, top-sorted).
// Output: data/kb/raw/youtube/<id>.json
//   {id,title,author,date,duration,chapters:[[t,title]],description,transcriptSource,
//    transcript:[{t,text}],comments:[{author,text,likes,ts,reply?}]}
// and data/kb/raw/youtube/transcript-index.json
//   [{id,title,author,date,lines,url,topics:{topic:[t,...]}}]  (link: url + '&t=' + t)
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ROOT, RAW, YTDLP, PYTHON, WORK, readJson, writeJson, logNew, run, sleep, now, clip, ytId, fetchRetry, isMain, arg, UA } from './lib.mjs';

const DIR = path.join(RAW, 'youtube');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_COMMENTS = 200;
const DW = /dragon ?wilds|kuldra|scorned wilderness|rsdw/i;
const TOPIC = /raid|kuldra|scorned|speed ?run|skip|\bwr\b|world record|record|tech|movement|jump|glide|windstep|wind step|zoop|parkour|boss|velgar|guide|patch|update|hotfix|any%|full run|solo|duo|run\b|tips|strat/i;
const EXTRA = (process.env.INGEST_EXTRA_SOURCES || (existsSync('D:\\claude-temp\\register\\raid-sources.json') ? 'D:\\claude-temp\\register\\raid-sources.json' : '')).split(/[;,]/).filter(Boolean);
const QUERIES = [
  'dragonwilds raid speedrun', 'kuldra speedrun', 'scorned wilderness speedrun', 'dragonwilds kuldra skip', 'dragonwilds raid skip',
  'scorned wilderness raid full run', 'kuldra raid full run', 'kuldra solo', 'kuldra duo', 'kuldra world record', 'scorned wilderness world record',
  'kuldra raid commentary', 'dragonwilds raid no commentary', 'dragonwilds speedrun', 'dragonwilds speedrun commentary', 'dragonwilds world record',
  'dragonwilds windstep', 'dragonwilds double jump', 'dragonwilds movement tech', 'dragonwilds glide tech', 'dragonwilds zoop', 'dragonwilds parkour skip',
  'kuldra boss guide', 'dragonwilds boss guide', 'dragonwilds velgar guide', 'dragonwilds raid guide', 'scorned wilderness guide',
  'dragonwilds patch notes', 'dragonwilds update 1.0.1', 'dragonwilds 1.0.1.2', 'dragonwilds hotfix raid', 'kuldra heart skip', 'kuldra poison skip',
];

// ---------------------------------------------------------------- discovery
async function search(q, sp) {
  const r = await fetchRetry('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + (sp ? '&sp=' + sp : ''), { headers: { 'User-Agent': UA } }, { tries: 3, base: 5000 });
  const h = await r.text();
  const m = h.match(/var ytInitialData = (\{.*?\});<\/script>/);
  if (!m) return [];
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      const title = (v.title?.runs || []).map(r => r.text).join('');
      const snippet = (v.detailedMetadataSnippets || []).flatMap(s => (s.snippetText?.runs || []).map(r => r.text)).join('');
      out.push({ id: v.videoId, title, author: (v.ownerText?.runs || []).map(r => r.text).join(''), snippet, length: v.lengthText?.simpleText || '' });
    }
    for (const k in o) walk(o[k]);
  })(JSON.parse(m[1]));
  return out.filter(v => DW.test(v.title + ' ' + v.snippet) && TOPIC.test(v.title + ' ' + v.snippet));
}

export async function discover({ log = logNew } = {}) {
  const file = path.join(DIR, '_discovered.json');
  const known = await readJson(file, {});
  let added = 0;
  for (const q of QUERIES) {
    for (const sp of [null, 'CAI%253D']) { // relevance, then newest first
      try {
        for (const v of await search(q, sp)) {
          if (known[v.id]) { known[v.id].queries = [...new Set([...known[v.id].queries, q])].slice(0, 10); continue; }
          known[v.id] = { id: v.id, title: v.title, author: v.author, length: v.length, firstSeen: now(), queries: [q] };
          added++;
        }
      } catch (e) { console.error('search', q, e.message); }
      await sleep(800);
    }
  }
  await writeJson(file, known);
  if (added) await log('youtube', 'progress', 'discover', `search found ${added} new videos (${Object.keys(known).length} discovered total)`);
  return { discovered: Object.keys(known).length, newlyDiscovered: added };
}

export async function videoList() {
  const list = new Map();
  const add = (id, o) => { if (id && /^[\w-]{11}$/.test(id) && !list.has(id)) list.set(id, { id, ...o }); };
  try {
    const { VIDEOS } = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'videos.js')).href);
    for (const v of VIDEOS) add(v.id, { from: 'videos.js', kind: v.kind, title: v.title, chapters: v.chapters || null });
  } catch (e) { console.error('videos.js:', e.message); }
  const src = await readJson(path.join(ROOT, 'data', 'sources.json'), { items: {} });
  for (const it of Object.values(src.items || {})) {
    if (it.kind === 'video') add(it.key.slice(3), { from: 'sources.json', kind: 'video', title: it.title });
    if (it.kind === 'run') add(ytId(it.video), { from: 'sources.json run', kind: 'run', title: it.title });
  }
  const runs = await readJson(path.join(RAW, 'speedrun', 'runs.json'), { runs: [] });
  for (const r of runs.runs) for (const u of r.videos) add(ytId(u), { from: 'speedrun.com', kind: 'run', title: `${r.players.join(' & ')} ${r.time}s` });
  for (const f of EXTRA) {
    const x = await readJson(f, []);
    for (const it of Array.isArray(x) ? x : Object.values(x)) {
      const urls = [it.url, it.video, ...(String(it.notes || '').match(/https?:\/\/\S+/g) || [])];
      for (const u of urls) add(ytId(u), { from: path.basename(f), kind: it.type || 'video', title: it.title });
    }
  }
  for (const v of Object.values(await readJson(path.join(DIR, '_discovered.json'), {}))) add(v.id, { from: 'search', kind: 'video', title: v.title });
  return [...list.values()];
}

// ---------------------------------------------------------------- captions
// json3 → [{t,text}] (t in seconds, 0.1 s). Auto captions arrive as many small rolling
// events; consecutive lines are merged into chunks of <= ~120 chars / 8 s.
export function parseJson3(j) {
  const merged = [];
  for (const e of j.events || []) {
    if (!e.segs) continue;
    const text = e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const t = Math.round((e.tStartMs || 0) / 100) / 10;
    const m = merged[merged.length - 1];
    if (m && m.text.length + text.length < 120 && t - m.t < 8) m.text += ' ' + text;
    else merged.push({ t, text });
  }
  return merged;
}

function pickCaption(info) {
  const subs = info.subtitles || {}, auto = info.automatic_captions || {};
  const json3 = arr => (arr || []).find(f => f.ext === 'json3');
  for (const k of Object.keys(subs).filter(k => /^en/.test(k))) if (json3(subs[k])) return { src: 'manual:' + k, url: json3(subs[k]).url };
  // non-English manual subs only if there are no English ones at all
  const lang = info.language || 'en';
  for (const k of ['en-orig', /^en/.test(lang) ? lang + '-orig' : null, 'en']) if (k && json3(auto[k])) return { src: 'auto:' + k, url: json3(auto[k]).url };
  const orig = Object.keys(auto).find(k => k.endsWith('-orig'));
  if (orig && json3(auto[orig])) return { src: 'auto:' + orig, url: json3(auto[orig]).url };
  const anyManual = Object.keys(subs).find(k => k !== 'live_chat' && json3(subs[k]));
  if (anyManual) return { src: 'manual:' + anyManual, url: json3(subs[anyManual]).url };
  return null;
}

const is429 = s => /HTTP Error 429|Too Many Requests/i.test(s);

async function ytdlpInfo(id, { comments }) {
  const args = ['-J', '--skip-download', '--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--sleep-requests', '0.5'];
  if (comments) args.push('--write-comments', '--extractor-args', `youtube:max_comments=${MAX_COMMENTS},all,20,3;comment_sort=top`);
  args.push(`https://www.youtube.com/watch?v=${id}`);
  for (let i = 0; i < 4; i++) {
    const r = await run(YTDLP, args);
    if (r.code === 0 && r.stdout.trim().startsWith('{')) return JSON.parse(r.stdout);
    if (is429(r.stderr) && i < 3) { const w = 30000 * 3 ** i; console.error(`  429 on ${id}; waiting ${w / 1000}s`); await sleep(w); continue; }
    const msg = (r.stderr || 'yt-dlp failed').split('\n').filter(l => /ERROR/.test(l)).join(' ').slice(0, 300) || r.stderr.slice(-300);
    const e = new Error(msg);
    e.is429 = is429(r.stderr); e.unavailable = !e.is429 && /unavailable|private video|removed|terminated|does not exist/i.test(r.stderr);
    throw e;
  }
}

async function captions(info) {
  const c = pickCaption(info);
  if (!c) return { transcript: [], src: 'none' };
  const r = await fetchRetry(c.url, {}, { tries: 5, base: 15000, label: 'timedtext ' + info.id });
  if (!r.ok) { const e = new Error(`${r.status} timedtext`); e.is429 = r.status === 429; throw e; }
  const txt = await r.text();
  if (!txt.trim()) throw new Error('empty timedtext response');
  return { transcript: parseJson3(JSON.parse(txt)), src: c.src };
}

const mapComments = cs => (cs || []).slice(0, MAX_COMMENTS).map(c => ({
  author: c.author, text: clip(c.text, 3000), likes: c.like_count || 0, ts: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : null,
  ...(c.parent && c.parent !== 'root' ? { reply: true } : {}), ...(c.author_is_uploader ? { op: true } : {}), ...(c.is_pinned ? { pinned: true } : {}),
}));
const ymd = d => (d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d || null);

function docFrom(info, v, old) {
  return {
    id: info.id, title: info.title, author: info.channel || info.uploader, channelId: info.channel_id || null,
    date: ymd(info.upload_date), duration: info.duration ?? null, views: info.view_count ?? null, likes: info.like_count ?? null,
    kind: v.kind, from: v.from,
    chapters: (info.chapters || []).length ? info.chapters.map(c => [Math.round(c.start_time * 10) / 10, c.title]) : (v.chapters || old?.chapters || []),
    description: clip(info.description || '', 8000),
    transcriptSource: old?.transcriptSource || 'pending', transcript: old?.transcript || [],
    commentCount: info.comment_count ?? old?.commentCount ?? null, comments: old?.comments || [], fetchedAt: now(),
  };
}

// ---------------------------------------------------------------- index
const TOPICS = {
  windstep: /wind ?step/i, 'double jump': /double jump/i, zoop: /\bzoop/i, glide: /glid/i, 'wind jump': /wind ?jump/i,
  skip: /\bskip/i, 'heart skip': /heart skip|skip (the )?heart/i, 'poison skip': /poison/i, 'air door': /air door/i, gate: /\bgate\b/i,
  kuldra: /kuldra/i, "kuldra's heart": /heart/i, thane: /\bthane/i, garou: /garou/i, necro: /necro/i, 'cataclysm keep': /cataclysm/i, puzzle: /puzzle/i,
  extraction: /extraction|get out/i, 'out of bounds': /out of bounds|\boob\b|clip(ped|ping)? (through|into)/i, stamina: /stamina/i, rock: /\brock\b/i, blocks: /\bblocks?\b/i,
  patch: /patch|hotfix|update/i, timer: /timer|split/i, reset: /\breset/i, 'world record': /world record|\bwr\b/i, 'sum of best': /sum of best/i, route: /\broute/i,
  boss: /\bboss/i, velgar: /velgar/i, spell: /\bspell/i, teleport: /teleport/i,
};
export async function buildIndex() {
  const files = (await readdir(DIR)).filter(f => /^[\w-]{11}\.json$/.test(f));
  const index = [];
  for (const f of files) {
    const d = await readJson(path.join(DIR, f), null);
    if (!d) continue;
    const topics = {};
    for (const l of d.transcript || []) for (const [k, re] of Object.entries(TOPICS)) if (re.test(l.text)) (topics[k] ||= []).length < 12 && topics[k].push(l.t);
    index.push({ id: d.id, title: d.title, author: d.author, date: d.date, duration: d.duration, lines: (d.transcript || []).length, source: d.transcriptSource, chapters: (d.chapters || []).length, comments: (d.comments || []).length, url: `https://www.youtube.com/watch?v=${d.id}`, topics });
  }
  index.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  await writeJson(path.join(DIR, 'transcript-index.json'), { builtAt: now(), videos: index.length, withTranscript: index.filter(x => x.lines).length, link: 'url + "&t=" + Math.floor(t) + "s"', index });
  return { indexed: index.length, withTranscript: index.filter(x => x.lines).length };
}

// ---------------------------------------------------------------- main
export async function ingestYoutube({ log = logNew, max = +arg('max', process.env.INGEST_YT_MAX || 1000), only = arg('only', null), refresh = !!arg('refresh', false), discoverNew = !arg('no-discover', false), doComments = !arg('no-comments', false), whisper = !!(arg('yt-whisper', false) || process.env.INGEST_YT_WHISPER === '1') } = {}) {
  const stats = { source: 'youtube', tracked: 0, newVideos: 0, transcripts: 0, newTranscripts: 0, noCaptions: 0, commentFetches: 0, comments: 0, newComments: 0, failed: 0, unavailable: 0, errors: [] };
  if (discoverNew && !only) Object.assign(stats, await discover({ log }));
  const state = await readJson(path.join(DIR, '_state.json'), {});
  const saveState = () => writeJson(path.join(DIR, '_state.json'), state);
  let list = await videoList();
  if (only) { const ids = String(only).split(','); list = ids.map(id => list.find(v => v.id === id) || { id, from: 'cli', kind: 'video' }); }
  stats.tracked = list.length;
  let streak429 = 0, done = 0, stop = false;

  // ---- phase 1: transcripts
  const need1 = list.filter(v => { const s = state[v.id] || {}; return !s.unavailable && (refresh || !s.transcript || s.transcript === 'retry'); });
  await log('youtube', 'progress', 'transcripts', `phase 1: ${need1.length} videos need transcripts (${list.length} tracked)`);
  for (const v of need1) {
    if (done >= max || stop) break;
    done++;
    const st = state[v.id] ||= {};
    const file = path.join(DIR, `${v.id}.json`);
    const old = await readJson(file, null);
    process.stderr.write(`yt[T ${done}/${need1.length}] ${v.id} ${clip(v.title || '', 60)}\n`);
    let info;
    try { info = await ytdlpInfo(v.id, { comments: false }); streak429 = 0; }
    catch (e) {
      stats.failed++; stats.errors.push(`${v.id}: ${e.message}`);
      if (e.unavailable) { st.unavailable = true; stats.unavailable++; }
      if (e.is429 && ++streak429 >= 3) { stop = true; stats.errors.push('stopped: YouTube kept returning 429; resumes next run'); }
      st.lastError = e.message.slice(0, 200); st.at = now(); await saveState();
      continue;
    }
    // Keep only Dragonwilds videos found by search (search results can drift off-topic).
    if (v.from === 'search' && !DW.test(`${info.title} ${info.description || ''} ${(info.tags || []).join(' ')}`)) { st.transcript = 'off-topic'; st.offTopic = true; await saveState(); continue; }
    const doc = docFrom(info, v, old);
    try {
      const c = await captions(info);
      doc.transcript = c.transcript; doc.transcriptSource = c.src; st.transcript = c.src === 'none' ? 'none' : 'ok';
      if (c.transcript.length) { stats.newTranscripts++; await log('youtube', 'transcript', v.id, `${doc.author}: ${doc.title} (${c.transcript.length} lines, ${c.src})`); }
      else stats.noCaptions++;
    } catch (e) {
      st.transcript = 'retry'; doc.transcriptSource = 'retry: ' + e.message.slice(0, 80); stats.errors.push(`${v.id} captions: ${e.message}`);
      if (e.is429 && ++streak429 >= 3) { stop = true; stats.errors.push('stopped: timedtext kept returning 429; resumes next run'); }
    }
    await writeJson(file, doc);
    if (!old) { stats.newVideos++; await log('youtube', 'video', v.id, doc.title); }
    st.fetchedAt = now(); delete st.lastError; await saveState();
    if (done % 10 === 0) { const ix = await buildIndex(); await log('youtube', 'progress', 'transcripts', `${done}/${need1.length} processed; ${ix.withTranscript}/${ix.indexed} videos on disk have transcripts`); }
    await sleep(1000);
  }
  const ix1 = await buildIndex();
  await log('youtube', 'progress', 'transcripts', `phase 1 done: ${ix1.withTranscript}/${ix1.indexed} videos have transcripts`);

  // ---- phase 1b (local, --whisper): Whisper for videos YouTube has no captions for
  if (whisper && !stop) {
    const maxMin = +(process.env.INGEST_WHISPER_MAX_MIN || 60);
    const ver = (await run(PYTHON, ['-c', 'import faster_whisper;print(faster_whisper.__version__)'], { timeout: 120000 })).code === 0;
    if (!ver) stats.errors.push('whisper requested but faster-whisper is not importable by ' + PYTHON);
    // raid / speedrun videos first, then the rest
    const pri = v => (/kuldra|scorned|raid/i.test(v.title || '') ? 0 : /speed ?run|skip|tech|record/i.test(v.title || '') ? 1 : 2);
    const needW = ver ? list.filter(v => state[v.id]?.transcript === 'none' && !state[v.id]?.whisper).sort((a, b) => pri(a) - pri(b)) : [];
    let n = 0;
    for (const v of needW) {
      const file = path.join(DIR, `${v.id}.json`);
      const doc = await readJson(file, null);
      if (!doc) continue;
      if (doc.duration > maxMin * 60) { state[v.id].whisper = 'too-long'; continue; }
      n++;
      process.stderr.write(`yt[W ${n}/${needW.length}] ${v.id} ${clip(doc.title || '', 60)} (${Math.round(doc.duration / 60)} min)\n`);
      try {
        await mkdir(WORK, { recursive: true });
        let audio = (await readdir(WORK)).find(f => f.startsWith(`yt-${v.id}.`));
        audio = audio ? path.join(WORK, audio) : null;
        if (!audio) {
          const r = await run(YTDLP, ['-f', 'bestaudio[abr<=80]/bestaudio/worst', '--no-warnings', '--no-part', '--js-runtimes', 'node', '-o', path.join(WORK, `yt-${v.id}.%(ext)s`), '--print', 'after_move:filepath', `https://www.youtube.com/watch?v=${v.id}`], { timeout: 30 * 60 * 1000 });
          if (r.code !== 0) throw new Error('audio: ' + clip(r.stderr.trim().split('\n').pop(), 200));
          audio = r.stdout.trim().split('\n').pop();
        }
        const w = await run(PYTHON, [path.join(HERE, 'whisper.py'), audio, process.env.INGEST_WHISPER_MODEL || 'small'], { timeout: 3 * 60 * 60 * 1000 });
        if (w.code !== 0) throw new Error('whisper: ' + clip(w.stderr.trim().split('\n').pop(), 200));
        const j = JSON.parse(w.stdout);
        // drop Whisper's usual silence hallucinations
        doc.transcript = j.segments.filter(s => !/^(thank you\.?|thanks for watching!?|you|\.+)$/i.test(s.text)).map(s => ({ t: s.t, text: s.text }));
        doc.transcriptSource = `whisper:${j.model} (${j.language})`;
        await writeJson(file, doc);
        state[v.id].whisper = doc.transcript.length ? 'ok' : 'empty';
        if (doc.transcript.length) { stats.newTranscripts++; stats.whisper = (stats.whisper || 0) + 1; await log('youtube', 'transcript', v.id, `${doc.author}: ${doc.title} (${doc.transcript.length} lines, whisper)`); }
      } catch (e) { state[v.id].whisper = 'error'; stats.errors.push(`${v.id} whisper: ${e.message}`); }
      await saveState();
    }
    const ixw = await buildIndex();
    await log('youtube', 'progress', 'transcripts', `whisper pass done: ${ixw.withTranscript}/${ixw.indexed} videos have transcripts`);
  }

  // ---- phase 2: comments (and metadata refresh)
  if (doComments && !stop) {
    const need2 = list.filter(v => {
      const s = state[v.id] || {};
      if (s.unavailable || s.offTopic || !s.fetchedAt) return false;
      if (!s.commentsAt || refresh) return true;
      const d = s.date ? (Date.now() - Date.parse(s.date)) / 864e5 : 999;
      return d < 60 && Date.now() - Date.parse(s.commentsAt) > 7 * 864e5;
    });
    let n = 0;
    for (const v of need2) {
      if (done >= max || stop) break;
      done++; n++;
      const st = state[v.id];
      const file = path.join(DIR, `${v.id}.json`);
      const old = await readJson(file, null);
      process.stderr.write(`yt[C ${n}/${need2.length}] ${v.id} ${clip(v.title || '', 60)}\n`);
      let info;
      try { info = await ytdlpInfo(v.id, { comments: true }); streak429 = 0; }
      catch (e) { stats.errors.push(`${v.id} comments: ${e.message}`); if (e.is429 && ++streak429 >= 3) stop = true; continue; }
      const doc = docFrom(info, v, old);
      doc.comments = mapComments(info.comments);
      if (old?.comments?.length) {
        const seen = new Set(old.comments.map(c => c.author + '\u0000' + c.text));
        for (const c of doc.comments) if (!seen.has(c.author + '\u0000' + c.text)) { stats.newComments++; await log('youtube', 'comment', v.id, `${c.author}: ${clip(c.text, 80)}`); }
      } else stats.newComments += doc.comments.length;
      await writeJson(file, doc);
      stats.commentFetches++;
      st.commentsAt = now(); st.date = doc.date; await saveState();
      if (n % 10 === 0) await log('youtube', 'progress', 'comments', `${n}/${need2.length} videos' comments fetched`);
      await sleep(1000);
    }
  }
  await saveState();
  const ix = await buildIndex();
  stats.onDisk = ix.indexed; stats.transcripts = ix.withTranscript;
  for (const f of (await readdir(DIR)).filter(f => /^[\w-]{11}\.json$/.test(f))) stats.comments += ((await readJson(path.join(DIR, f), {})).comments || []).length;
  stats.noCaptionsTotal = Object.values(state).filter(s => s.transcript === 'none').length;
  stats.pendingRetry = Object.values(state).filter(s => s.transcript === 'retry').length;
  if (stats.errors.length > 40) stats.errors = [...stats.errors.slice(0, 40), `… ${stats.errors.length - 40} more`];
  return stats;
}

if (isMain(import.meta)) console.log(JSON.stringify(await ingestYoutube()));
