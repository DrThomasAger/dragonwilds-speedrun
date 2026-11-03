// Shared helpers for the knowledge-base ingest scripts (scripts/ingest/*.mjs).
// Everything here writes compact JSON (no pretty-printing) under data/kb/raw/.
import { readFile, writeFile, appendFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const RAW = path.join(ROOT, 'data', 'kb', 'raw');
export const LOG_FILE = path.join(RAW, 'ingest-log.jsonl');

// On this PC nothing may be written to C:. If D:\claude-temp exists, point every
// temp/cache directory that child processes (yt-dlp, pip, whisper) use at it.
export const LOCAL_TEMP = process.env.INGEST_TEMP || (process.platform === 'win32' && existsSync('D:\\claude-temp') ? 'D:\\claude-temp' : null);
export const childEnv = (() => {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  if (LOCAL_TEMP) {
    const t = path.join(LOCAL_TEMP, 'tmp');
    Object.assign(env, {
      TEMP: t, TMP: t, TMPDIR: t,
      PIP_CACHE_DIR: path.join(LOCAL_TEMP, 'pip-cache'),
      npm_config_cache: path.join(LOCAL_TEMP, 'npm-cache'),
      HF_HOME: path.join(LOCAL_TEMP, 'ingest', 'hf'),
      XDG_CACHE_HOME: path.join(LOCAL_TEMP, 'ingest', 'cache'),
    });
  }
  return env;
})();

// Local tool locations (venv under D:\claude-temp\ingest\venv), else PATH (CI).
const VENV = LOCAL_TEMP ? path.join(LOCAL_TEMP, 'ingest', 'venv', 'Scripts') : null;
export const YTDLP = process.env.YTDLP || (VENV && existsSync(path.join(VENV, 'yt-dlp.exe')) ? path.join(VENV, 'yt-dlp.exe') : 'yt-dlp');
export const PYTHON = process.env.INGEST_PYTHON || (VENV && existsSync(path.join(VENV, 'python.exe')) ? path.join(VENV, 'python.exe') : 'python3');
export const WORK = LOCAL_TEMP ? path.join(LOCAL_TEMP, 'ingest', 'work') : path.join(ROOT, '.ingest-work');

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const now = () => new Date().toISOString();

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
// Skips the write when only a top-level timestamp (fetchedAt/builtAt) would change,
// so the hourly workflow doesn't commit no-op diffs.
const STAMP = new Set(['fetchedAt', 'builtAt']);
const unstamped = d => JSON.stringify(d && typeof d === 'object' && !Array.isArray(d) ? Object.fromEntries(Object.entries(d).filter(([k]) => !STAMP.has(k))) : d);
export async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  try { if (unstamped(JSON.parse(await readFile(file, 'utf8'))) === unstamped(data)) return false; } catch { /* new file */ }
  await writeFile(file, JSON.stringify(data) + '\n');
  return true;
}
export const exists = f => access(f).then(() => true, () => false);

// One JSON line per new item: {at, source, kind, id, title}
export async function logNew(source, kind, id, title) {
  await mkdir(RAW, { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify({ at: now(), source, kind, id: String(id), title: title ?? '' }) + '\n');
}

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// fetch with retry/backoff on 429 and 5xx. Honours Retry-After.
export async function fetchRetry(url, opts = {}, { tries = 5, base = 2000, label = url } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, 'Accept-Language': 'en', ...(opts.headers || {}) } });
      if (r.status === 429 || r.status >= 500) {
        const ra = +r.headers.get('retry-after');
        const wait = ra ? ra * 1000 : base * 2 ** i;
        last = new Error(`${r.status} ${label}`); last.status = r.status;
        await sleep(Math.min(wait, 120000));
        continue;
      }
      return r;
    } catch (e) { last = e; await sleep(base * 2 ** i); }
  }
  throw last;
}
export async function getJson(url, opts, retry) {
  const r = await fetchRetry(url, opts, retry);
  if (!r.ok) { const e = new Error(`${r.status} ${url}`); e.status = r.status; throw e; }
  return r.json();
}

export function run(cmd, args, { timeout = 15 * 60 * 1000, maxBuffer = 512 * 1024 * 1024 } = {}) {
  return new Promise(resolve => {
    execFile(cmd, args, { env: childEnv, timeout, maxBuffer, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout: stdout || '', stderr: stderr || (err && !stdout ? String(err.message) : '') });
    });
  });
}

export const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
export const ytId = u => (String(u || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/) || [])[1] || null;
export const twitchVod = u => (String(u || '').match(/twitch\.tv\/(?:[\w]+\/)?(?:videos|v)\/(\d+)/) || [])[1] || null;

// Shared speedrun.com constants (same as scripts/track-sources.mjs).
export const SRC = { GAME: '2689lo91', CAT: 'xd19vy4k', VERSION_VAR: 'rn163418', NEW_BRACKET: '1gn0epol' };
export const RUNNERS = ['TexasPete', 'Nanobit', 'Nimblesk', 'ChiefWes', 'ShadowStalkerTM', 'heartlessedly', 'superstooob', 'funkybasic', 'dotyoureyes'];

// True when the module was started directly (node scripts/ingest/x.mjs).
export const isMain = meta => process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === meta.url;
export const arg = (name, def) => {
  const a = process.argv.find(x => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
};
