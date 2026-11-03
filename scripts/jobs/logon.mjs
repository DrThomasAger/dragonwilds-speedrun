// "RaidLab Logon" (at logon): starts the `bb lab` bridge (if nothing is on 127.0.0.1:5180) and the
// live Twitch chat monitor scripts/ingest/twitch-live.mjs (if it is not already running), both hidden.
// Replaces logon.cmd, which opened two minimised cmd windows and was blocked on battery power.
// Log: D:\claude-temp\logs\logon-<date>.log (+ bridge.log, twitch-live.log)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { logger, listening, startDetached, run, ROOT, LOGDIR } from './lib.mjs';

const L = logger('logon');
L.say('start');
if (await listening(5180)) L.say('bb lab bridge: already up on 5180');
else L.say(`bb lab bridge: started (pid ${startDetached('bb', ['lab'], { cwd: ROOT, log: `${LOGDIR}/bridge.log` })})`);

// Already running? pid file first (cheap, works in any session), then a process-list check.
const PIDFILE = 'D:/claude-temp/locks/twitch-live.pid';
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
let running = false;
try { const pid = +readFileSync(PIDFILE, 'utf8'); running = pid > 0 && alive(pid); } catch {}
if (!running) {
  const ps = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'twitch-live\\.mjs' }).Count"], { timeout: 60000 });
  running = parseInt((ps.stdout || '').trim(), 10) > 0;
  if (ps.status !== 0) L.say(`process check failed (exit ${ps.status}): ${(ps.stderr || '').slice(0, 200)}`);
}
if (running) L.say('twitch-live: already running');
else {
  const pid = startDetached('node', ['scripts/ingest/twitch-live.mjs'], { cwd: ROOT, log: `${LOGDIR}/twitch-live.log` });
  mkdirSync('D:/claude-temp/locks', { recursive: true });
  writeFileSync(PIDFILE, String(pid));
  L.say(`twitch-live: started (pid ${pid})`);
}
L.say('done');
process.exit(0);
