// Shared helpers for the scheduled jobs in scripts/jobs (Windows Task Scheduler).
// Keeps every temp file, cache and log on D: and hides every child window.
import { spawnSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, openSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';

export const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const LOGDIR = 'D:/claude-temp/logs';
for (const d of ['logs', 'tmp', 'npm-cache', 'pip-cache', 'hf', 'cache', 'ms-playwright']) mkdirSync(`D:/claude-temp/${d}`, { recursive: true });

export const env = {
  ...process.env,
  TEMP: 'D:\\claude-temp\\tmp', TMP: 'D:\\claude-temp\\tmp', TMPDIR: 'D:/claude-temp/tmp',
  npm_config_cache: 'D:\\claude-temp\\npm-cache', PIP_CACHE_DIR: 'D:\\claude-temp\\pip-cache',
  HF_HOME: 'D:\\claude-temp\\hf', XDG_CACHE_HOME: 'D:\\claude-temp\\cache',
  PLAYWRIGHT_BROWSERS_PATH: 'D:\\claude-temp\\ms-playwright', PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1',
};
Object.assign(process.env, env);

export const today = () => new Date().toISOString().slice(0, 10);

/** Logger for one job: D:\claude-temp\logs\<job>-<date>.log */
export function logger(job) {
  const file = join(LOGDIR, `${job}-${today()}.log`);
  const say = m => { const line = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(file, line); process.stdout.write(line); };
  const raw = s => { if (s) appendFileSync(file, s.endsWith('\n') ? s : s + '\n'); };
  return { file, say, raw };
}

/** Run a command to completion, hidden; returns spawnSync result. */
export function run(cmd, args, { cwd = ROOT, timeout = 45 * 60 * 1000, shell = false } = {}) {
  return spawnSync(cmd, args, { cwd, env, encoding: 'utf8', timeout, maxBuffer: 256 * 1024 * 1024, windowsHide: true, shell });
}

/** Run a named step, append the tail of its output to the log, return true on success. */
export function step(L, name, cmd, args, opts) {
  const t = Date.now();
  const r = run(cmd, args, opts);
  L.raw((r.stdout || '').slice(-6000) + (r.stderr || '').slice(-6000));
  const ok = r.status === 0;
  L.say(`${ok ? 'ok  ' : 'FAIL'} ${name} (exit ${r.status ?? r.error?.code ?? 'timeout'}, ${((Date.now() - t) / 1000).toFixed(0)} s)`);
  return { ok, r };
}

/** Start a long-running process detached and hidden, output to a log file on D:. */
export function startDetached(cmd, args, { cwd, log }) {
  const fd = openSync(log, 'a');
  const p = spawn(cmd, args, { cwd, env, detached: true, windowsHide: true, stdio: ['ignore', fd, fd], shell: true });
  p.unref();
  return p.pid;
}

/** True if something accepts TCP connections on 127.0.0.1:port. */
export function listening(port, ms = 1500) {
  return new Promise(res => {
    const s = createConnection({ host: '127.0.0.1', port });
    const done = v => { s.destroy(); res(v); };
    s.setTimeout(ms, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

/** git add <paths>, commit if anything changed, then push any unpushed commits
 *  (also ones left by an earlier failed push). extraPush: more refspecs. Returns false if the push failed. */
export function publish(L, cwd, paths, message, extraPush = []) {
  const git = (...a) => run('git', a, { cwd, timeout: 10 * 60 * 1000 });
  git('add', '--', ...paths);
  if (git('diff', '--cached', '--quiet').status !== 0)
    git('commit', '-q', '-m', `${message}\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`);
  const ahead = +(git('rev-list', '--count', 'origin/main..HEAD').stdout || '0').trim();
  if (!ahead) { L.say('nothing new to publish'); return true; }
  let p;
  for (let i = 0; i < 3; i++) { p = git('push', '-q', 'origin', 'main'); if (p.status === 0) break; }
  for (const ref of extraPush) git('push', '-q', 'origin', ref);
  L.say(p.status === 0 ? `published ${ahead} commit(s)` : 'push failed (will retry next run): ' + (p.stderr || '').trim().slice(0, 300));
  return p.status === 0;
}
