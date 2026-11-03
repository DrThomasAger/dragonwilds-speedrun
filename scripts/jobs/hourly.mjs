// Hourly local job (Windows Task Scheduler: "RaidLab Hourly").
// Runs every pipeline in order, logs to D:\claude-temp\logs, keeps all temp/caches on D:,
// then publishes new data: pull --rebase, commit data/ + docs/, push main and gh-pages.
// The GitHub Actions jobs do the light work too; this one adds what needs this PC
// (video downloads for reviews, transcripts that YouTube rate-limits on CI, Whisper).
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LOGDIR = 'D:/claude-temp/logs';
mkdirSync(LOGDIR, { recursive: true });
const log = join(LOGDIR, `jobs-${new Date().toISOString().slice(0, 10)}.log`);
const env = {
  ...process.env,
  TEMP: 'D:\\claude-temp\\tmp', TMP: 'D:\\claude-temp\\tmp', TMPDIR: 'D:/claude-temp/tmp',
  npm_config_cache: 'D:\\claude-temp\\npm-cache', PIP_CACHE_DIR: 'D:\\claude-temp\\pip-cache',
  HF_HOME: 'D:\\claude-temp\\hf', XDG_CACHE_HOME: 'D:\\claude-temp\\cache', PYTHONUTF8: '1',
};
mkdirSync('D:/claude-temp/tmp', { recursive: true });
const say = m => { const line = `[${new Date().toISOString()}] ${m}\n`; appendFileSync(log, line); process.stdout.write(line); };

const STEPS = [
  ['patch notes', ['node', 'scripts/fetch-patchnotes.mjs']],
  ['sources', ['node', 'scripts/track-sources.mjs']],
  ['ingest (YouTube, Twitch VODs, speedrun.com, Reddit)', ['node', 'scripts/ingest/run-all.mjs']],
  ['reviews of new runs', ['node', 'scripts/review/run.mjs']],
  ['analysis', ['node', '--max-old-space-size=4096', 'scripts/analysis/run-all.mjs']],
  ['knowledge base', ['node', 'scripts/build-kb.mjs']],
];

for (const [name, cmd] of STEPS) {
  if (!existsSync(join(ROOT, cmd[cmd.length - 1]))) { say(`skip ${name}: ${cmd.at(-1)} not built yet`); continue; }
  const t = Date.now();
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, env, encoding: 'utf8', timeout: 45 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  appendFileSync(log, (r.stdout || '').slice(-4000) + (r.stderr || '').slice(-4000));
  say(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
}

const git = (...a) => spawnSync('git', a, { cwd: ROOT, env, encoding: 'utf8' });
git('pull', '--rebase', '--autostash', '-q', 'origin', 'main');
git('add', 'data', 'docs');
if (git('diff', '--cached', '--quiet').status !== 0) {
  git('commit', '-q', '-m', `data: hourly local refresh ${new Date().toISOString().slice(0, 16)}Z\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`);
  const p = git('push', '-q', 'origin', 'main');
  git('push', '-q', 'origin', 'HEAD:gh-pages');
  say(p.status === 0 ? 'published' : 'push failed: ' + p.stderr.slice(0, 300));
} else say('nothing new to publish');
