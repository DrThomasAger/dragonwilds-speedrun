// Shared paths, tool locations and helpers for the raid review pipeline.
// Nothing is written to C:. Locally every download, venv, cache and temp file lives
// under D:\claude-temp\review (override with REVIEW_HOME); in CI under .review-work/.
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
// YouTube "Sign in to confirm you're not a bot": same back-off rules as the ingest.
export { isBotBlock, backoffUntil, backedOff } from '../ingest/lib.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OUT = path.join(ROOT, 'data', 'kb', 'reviews');
export const DOCS = path.join(ROOT, 'docs', 'review');
export const TEMPLATES = path.join(ROOT, 'scripts', 'review', 'templates');

const LOCAL = process.platform === 'win32' && existsSync('D:\\') ? 'D:\\claude-temp\\review' : null;
export const HOME = process.env.REVIEW_HOME || LOCAL || path.join(ROOT, '.review-work');
export const DIRS = {
  vid: path.join(HOME, 'vid'), subs: path.join(HOME, 'subs'), work: path.join(HOME, 'work'),
  frames: path.join(HOME, 'frames'), tmp: path.join(HOME, 'tmp'), hf: path.join(HOME, 'hf'),
};

export const childEnv = {
  ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1',
  TEMP: DIRS.tmp, TMP: DIRS.tmp, TMPDIR: DIRS.tmp,
  PIP_CACHE_DIR: path.join(HOME, 'pip-cache'), HF_HOME: DIRS.hf, XDG_CACHE_HOME: path.join(HOME, 'cache'),
};

const VENV = path.join(HOME, 'venv', process.platform === 'win32' ? 'Scripts' : 'bin');
const exe = n => (process.platform === 'win32' ? n + '.exe' : n);
export const PYTHON = process.env.REVIEW_PYTHON || (existsSync(path.join(VENV, exe('python'))) ? path.join(VENV, exe('python')) : (process.platform === 'win32' ? 'python' : 'python3'));
export const YTDLP = process.env.YTDLP || (existsSync(path.join(VENV, exe('yt-dlp'))) ? path.join(VENV, exe('yt-dlp')) : 'yt-dlp');
export const FFMPEG = process.env.FFMPEG || (existsSync('D:/ffmpeg/ffmpeg.exe') ? 'D:/ffmpeg/ffmpeg.exe' : 'ffmpeg');
export const FFPROBE = process.env.FFPROBE || (existsSync('D:/ffmpeg/ffprobe.exe') ? 'D:/ffmpeg/ffprobe.exe' : 'ffprobe');
// Older caches other local tools already downloaded (read-only, copied never moved).
export const EXTRA_VIDEO_DIRS = (process.env.REVIEW_EXTRA_VID || (LOCAL ? 'D:\\claude-temp\\runpath\\vid' : '')).split(';').filter(Boolean);

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const now = () => new Date().toISOString();
export const exists = f => access(f).then(() => true, () => false);
export async function ensureDirs() { for (const d of Object.values(DIRS)) await mkdir(d, { recursive: true }); }

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
// Atomic write (tmp + rename) so a crash never leaves half a JSON file.
export async function writeJson(file, data, pretty = true) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await writeFile(tmp, (pretty ? JSON.stringify(data, null, 1) : JSON.stringify(data)) + '\n');
  await rename(tmp, file);
}
export async function writeText(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

export function run(cmd, args, { timeout = 30 * 60 * 1000, maxBuffer = 1024 * 1024 * 1024, cwd } = {}) {
  return new Promise(resolve => {
    execFile(cmd, args, { env: childEnv, timeout, maxBuffer, windowsHide: true, encoding: 'utf8', cwd }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: stdout || '', stderr: stderr || (err ? String(err.message) : ''), missing: err?.code === 'ENOENT' });
    });
  });
}

export const VALID_ID = /^[\w-]{11}$/;
export const ytId = u => (String(u || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/) || [])[1] || null;
export const link = (id, t) => `https://youtu.be/${id}${t != null ? `?t=${Math.max(0, Math.floor(t))}` : ''}`;
export const fmt = s => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);
export const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');
export const isMain = meta => process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === meta.url;
export const arg = (name, def, argv = process.argv) => {
  const a = argv.find(x => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
};

let _tools;
export async function tools() {
  if (_tools) return _tools;
  const [ff, yt] = await Promise.all([run(FFMPEG, ['-version'], { timeout: 30000 }), run(YTDLP, ['--version'], { timeout: 60000 })]);
  let py;
  for (let i = 0; i < 3; i++) { py = await run(PYTHON, ['-c', 'import cv2, numpy; print("ok")'], { timeout: 120000 }); if (py.code === 0) break; await sleep(5000); }
  const wh = await run(PYTHON, ['-c', 'import faster_whisper; print("ok")'], { timeout: 60000 });
  _tools = { ffmpeg: ff.code === 0, cv: py.code === 0 && py.stdout.includes('ok'), ytdlp: yt.code === 0, whisper: wh.code === 0 && wh.stdout.includes('ok') };
  return _tools;
}

// Short hash of the scanner + templates: feature caches are keyed by it so a changed
// detector never reuses stale features.
import { createHash } from 'node:crypto';
let _sv;
export async function scanVersion() {
  if (_sv) return _sv;
  const h = createHash('sha1');
  for (const f of [path.join(ROOT, 'scripts', 'review', 'scan.py'), path.join(TEMPLATES, 'banner.png'), path.join(TEMPLATES, 'getout.png')]) {
    try { h.update(await readFile(f)); } catch { h.update('missing:' + f); }
  }
  return (_sv = h.digest('hex').slice(0, 8));
}
