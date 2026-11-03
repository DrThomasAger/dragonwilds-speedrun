// Shared helpers for the scheduled jobs in scripts/jobs (Windows Task Scheduler).
// Keeps every temp file, cache and log on D: and hides every child window.
import { spawnSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
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

/** Run a named step, append the tail of its output to the log, return true on success.
 *  opts.stream: write the child's output straight into the log as it runs (progress survives a crash). */
export function step(L, name, cmd, args, opts = {}) {
  const t = Date.now();
  L.say(`start ${name}`);
  let r;
  if (opts.stream) {
    const fd = openSync(L.file, 'a');
    r = spawnSync(cmd, args, { cwd: opts.cwd || ROOT, env, timeout: opts.timeout || 45 * 60 * 1000, windowsHide: true, stdio: ['ignore', fd, fd], killSignal: 'SIGKILL' });
    closeSync(fd);
  } else {
    r = run(cmd, args, opts);
    L.raw((r.stdout || '').slice(-6000) + (r.stderr || '').slice(-6000));
  }
  const ok = r.status === 0;
  L.say(`${ok ? 'ok  ' : 'FAIL'} ${name} (exit ${r.status ?? r.error?.code ?? 'timeout'}, ${((Date.now() - t) / 1000).toFixed(0)} s)`);
  return { ok, r };
}

/** One lock shared by the jobs that write data/ (Hourly, Transcripts, Daily Review), so they never
 *  run at the same time. File: D:\claude-temp\locks\raidlab-data.lock = {pid, job, at}. A lock whose
 *  pid is gone is stale and taken over. Waits up to waitMin minutes; returns false if still busy. */
const LOCKFILE = 'D:/claude-temp/locks/raidlab-data.lock';
const pidAlive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
export async function acquireLock(L, job, waitMin = 30) {
  mkdirSync('D:/claude-temp/locks', { recursive: true });
  const until = Date.now() + waitMin * 60 * 1000;
  let told = false;
  for (;;) {
    try {
      writeFileSync(LOCKFILE, JSON.stringify({ pid: process.pid, job, at: new Date().toISOString() }), { flag: 'wx' });
      const release = () => { try { if (JSON.parse(readFileSync(LOCKFILE, 'utf8')).pid === process.pid) unlinkSync(LOCKFILE); } catch {} };
      process.on('exit', release);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let held = null;
      try { held = JSON.parse(readFileSync(LOCKFILE, 'utf8')); } catch {}
      if (!held?.pid || !pidAlive(held.pid)) { try { unlinkSync(LOCKFILE); } catch {} continue; } // stale lock file
      if (Date.now() > until) { L.say(`busy: ${held.job} (pid ${held.pid}) still running, skipping this run`); return false; }
      if (!told) { L.say(`waiting for ${held.job} (pid ${held.pid}) to finish`); told = true; }
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

/** After the PC wakes, DNS often isn't back for a minute. Wait (up to maxSec) until host resolves. */
export async function waitForNetwork(L, host = 'www.youtube.com', maxSec = 300) {
  const until = Date.now() + maxSec * 1000;
  for (let i = 0; ; i++) {
    try { await lookup(host); if (i) L.say(`network back after ${i * 10} s`); return true; }
    catch { if (Date.now() > until) { L.say(`no network after ${maxSec} s, running anyway`); return false; } }
    await new Promise(r => setTimeout(r, 10000));
  }
}

/** Start a long-running process detached and hidden, output to a log file on D:.
 *  cmd must be an .exe on PATH (bb, node, python): with shell:true (or via cmd.exe) a detached
 *  child's output never reached the log (bridge.log / osrs-gui.log stayed empty). */
export function startDetached(cmd, args, { cwd, log }) {
  const fd = openSync(log, 'a');
  const p = spawn(cmd, args, { cwd, env, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
  closeSync(fd);
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
