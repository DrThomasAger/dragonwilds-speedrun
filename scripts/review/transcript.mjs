// Transcripts for the review pipeline: YouTube captions (manual > auto en-orig > auto en)
// with word-level timing from json3, else a local faster-whisper transcription of the
// downloaded audio, else marked "none".
import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { DIRS, ROOT, YTDLP, FFMPEG, PYTHON, run, readJson, exists, VALID_ID, isBotBlock } from './lib.mjs';

// json3 → lines [{t, text}] with t = start of the first word of the line (video s).
// Auto captions arrive as rolling events whose words carry tOffsetMs; lines are cut at
// sentence punctuation, pauses > 1.2 s or ~90 characters.
export function json3Lines(j) {
  const words = [];
  for (const e of j.events || []) {
    if (!e.segs) continue;
    const base = e.tStartMs || 0;
    for (const s of e.segs) {
      const w = (s.utf8 || '').replace(/\s+/g, ' ');
      if (!w.trim()) { if (words.length && w === '\n') words[words.length - 1].nl = true; continue; }
      words.push({ t: (base + (s.tOffsetMs || 0)) / 1000, w });
    }
  }
  return wordsToLines(words);
}

export function wordsToLines(words) {
  const lines = [];
  let cur = null, lastT = -1;
  for (const { t, w } of words) {
    if (cur && (t - lastT > 1.2 || cur.text.length > 90)) { lines.push(cur); cur = null; }
    if (!cur) cur = { t: Math.round(t * 10) / 10, text: '' };
    cur.text += (cur.text && !/^\s/.test(w) ? ' ' : '') + w;
    lastT = t;
    if (/[.!?]["”]?\s*$/.test(w) && cur.text.length > 12) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);
  return lines.map(l => ({ t: l.t, text: l.text.replace(/\s+/g, ' ').trim() })).filter(l => l.text && !/^\[(music|applause)\]$/i.test(l.text));
}

async function subFile(id) {
  let files = [];
  try { files = (await readdir(DIRS.subs)).filter(f => f.startsWith(id + '.') && f.endsWith('.json3')); } catch { return null; }
  const pref = [/\.en\.json3$/, /\.en-(US|GB)\.json3$/, /\.en-orig\.json3$/, /\.en.*\.json3$/];
  for (const p of pref) { const f = files.find(x => p.test(x)); if (f) return path.join(DIRS.subs, f); }
  return null;
}

// Metadata + captions with one yt-dlp call (cached in DIRS.subs).
export async function fetchMeta(id, { retrySubs = false } = {}) {
  if (!VALID_ID.test(id)) return { ok: false, error: `invalid YouTube id "${id}"`, unavailable: true };
  const infoFile = path.join(DIRS.subs, `${id}.info.json`);
  let subsError = null;
  if (!(await exists(infoFile)) || retrySubs) {
    const common = ['--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--sleep-requests', '0.5', '-o', path.join(DIRS.subs, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${id}`];
    let r = await run(YTDLP, ['--skip-download', '--write-info-json', '--no-write-comments', '--write-subs', '--write-auto-subs',
      '--sub-langs', 'en,en-orig,en-US,en-GB', '--sub-format', 'json3', ...common], { timeout: 5 * 60 * 1000 });
    if (r.missing) return { ok: false, error: 'yt-dlp not installed' };
    if (r.code !== 0 && /subtitles/i.test(r.stderr)) {
      // captions rate-limited (429) or broken: keep going with metadata only
      subsError = (r.stderr.split('\n').find(l => /ERROR/.test(l)) || 'subtitle download failed').slice(0, 200);
      if (!(await exists(infoFile))) r = await run(YTDLP, ['--skip-download', '--write-info-json', '--no-write-comments', ...common], { timeout: 5 * 60 * 1000 });
    }
    if (!(await exists(infoFile))) {
      const msg = (r.stderr.split('\n').filter(l => /ERROR/.test(l)).join(' ') || r.stderr).trim().slice(0, 300) || 'yt-dlp failed';
      // a bot check / 429 blocks the IP, not the video: never call it unavailable
      const botBlock = isBotBlock(r.stderr), rateLimited = botBlock || /429|Too Many Requests/i.test(msg);
      return { ok: false, error: msg, unavailable: !rateLimited && /unavailable|private|removed|terminated|not available|does not exist|Incomplete YouTube ID/i.test(msg), rateLimited, botBlock };
    }
  }
  const info = await readJson(infoFile, {});
  return {
    ok: true, subsError,
    meta: { id, title: info.title, author: info.channel || info.uploader, channelId: info.channel_id, duration: info.duration, date: info.upload_date ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6)}` : null, description: info.description || '', chapters: (info.chapters || []).map(c => [c.start_time, c.title]), views: info.view_count ?? null },
  };
}

export async function captionLines(id) {
  const f = await subFile(id);
  if (!f) return null;
  try {
    const lines = json3Lines(JSON.parse(await readFile(f, 'utf8')));
    return lines.length ? { lines, source: 'youtube:' + path.basename(f).split('.').slice(1, -1).join('.') } : null;
  } catch { return null; }
}

// Existing ingest cache (data/kb/raw/youtube/<id>.json, merged caption lines).
export async function rawLines(id) {
  const d = await readJson(path.join(ROOT, 'data', 'kb', 'raw', 'youtube', `${id}.json`), null);
  if (d?.transcript?.length) return { lines: d.transcript.map(l => ({ t: l.t, text: l.text })), source: 'kb-raw:' + (d.transcriptSource || 'yt'), raw: d };
  return d ? { lines: null, raw: d } : null;
}

// One whisper process at a time (the small model needs ~1 GB; parallel loads fail and
// fall back to tiny, which hallucinates).
let whisperChain = Promise.resolve();
export function whisperLines(id, video, opts) {
  const p = whisperChain.then(() => whisperOnce(id, video, opts));
  whisperChain = p.catch(() => {});
  return p;
}

async function whisperOnce(id, video, { model = process.env.REVIEW_WHISPER_MODEL || 'small', maxSeconds = 25 * 60 } = {}) {
  const cache = path.join(DIRS.work, `${id}.whisper-v2.json`);
  const c = await readJson(cache, null);
  if (c?.lines && c.source !== 'whisper:tiny') return c; // tiny (memory fallback) is retried next time
  // one reused scratch file (whisper runs one at a time), overwritten each run
  const wav = path.join(DIRS.tmp, 'whisper-input.wav');
  const a = await run(FFMPEG, ['-v', 'error', '-y', '-i', video, '-t', String(maxSeconds), '-vn', '-ac', '1', '-ar', '16000', wav], { timeout: 10 * 60 * 1000 });
  if (a.code !== 0) return { lines: null, error: 'audio extract failed: ' + a.stderr.slice(-200) };
  // wait (up to 30 min) for 3 GB free RAM, so whisper never pushes Windows to grow the page file on C:
  const { freemem } = await import('node:os');
  for (let w = 0; w < 60 && freemem() < 3 * 2 ** 30; w++) await new Promise(res => setTimeout(res, 30000));
  if (freemem() < 3 * 2 ** 30) return { lines: null, error: 'skipped: low memory (retried next run)' };
  let r;
  for (let i = 0; i < 2; i++) { // a transient out-of-memory (other processes) is retried once
    r = await run(PYTHON, ['-I', path.join(ROOT, 'scripts', 'review', 'whisper.py'), wav, model], { timeout: 90 * 60 * 1000 });
    if (r.code === 0 && r.stdout.trim().startsWith('{')) break;
    await new Promise(res => setTimeout(res, 15000));
  }
  if (r.code !== 0 || !r.stdout.trim().startsWith('{')) {
    await writeFile(path.join(DIRS.work, `${id}.whisper.err.txt`), r.stderr).catch(() => {});
    return { lines: null, error: 'whisper failed: ' + r.stderr.trim().split(/\r?\n/).slice(-1)[0].slice(0, 300) };
  }
  const out = JSON.parse(r.stdout);
  const res = { lines: wordsToLines(out.words), source: `whisper:${out.model}`, language: out.language };
  const { writeJson } = await import('./lib.mjs');
  await writeJson(cache, res, false);
  if (out.model !== model) res.warning = `${model} failed (memory); used ${out.model}`;
  return res;
}
