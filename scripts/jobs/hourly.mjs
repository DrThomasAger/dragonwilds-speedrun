// Hourly local job (Windows Task Scheduler: "RaidLab Hourly", run hidden via hidden.vbs).
// Runs every pipeline in order, logs to D:\claude-temp\logs\jobs-<date>.log (each step's output
// is streamed into the log while it runs), keeps all temp/caches on D:, then publishes new data:
// pull --rebase, commit data/ + docs/, push main and gh-pages.
// Takes the shared data lock so it never overlaps "RaidLab Transcripts" or "RaidLab Daily Review".
// The GitHub Actions jobs do the light work too; this one adds what needs this PC
// (video downloads for reviews, transcripts that YouTube rate-limits on CI, Whisper).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger, step, run, publish, acquireLock, waitForNetwork, ROOT } from './lib.mjs';

const L = logger('jobs');
const M = 60 * 1000;
L.say(`hourly start (pid ${process.pid})`);
process.on('exit', c => L.say(`hourly exit ${c}`));

if (!(await acquireLock(L, 'RaidLab Hourly', 30))) process.exit(0);
await waitForNetwork(L);

// [name, command, per-step timeout]. Total stays well under the task's 2 h limit.
const STEPS = [
  ['patch notes', ['node', 'scripts/fetch-patchnotes.mjs'], 2 * M],
  ['sources', ['node', 'scripts/track-sources.mjs'], 5 * M],
  // --max=40: at most 40 yt-dlp calls (~25 s each) per hour, so YouTube's comment backlog
  // (300+ videos, ~2.5 h) is worked off over several runs and Twitch/Reddit still get their turn.
  ['ingest (YouTube, Twitch VODs, speedrun.com, Reddit)', ['node', 'scripts/ingest/run-all.mjs', '--max=40'], 35 * M],
  ['reviews of new runs', ['node', 'scripts/review/run.mjs'], 30 * M],
  ['analysis', ['node', '--max-old-space-size=4096', 'scripts/analysis/run-all.mjs'], 15 * M],
  ['knowledge base', ['node', 'scripts/build-kb.mjs'], 10 * M],
];

let failed = 0;
for (const [name, cmd, timeout] of STEPS) {
  const script = cmd.find(a => a.startsWith('scripts/'));
  if (!existsSync(join(ROOT, script))) { L.say(`skip ${name}: ${script} not built yet`); continue; }
  if (!step(L, name, cmd[0], cmd.slice(1), { timeout, stream: true }).ok) failed++;
}

run('git', ['pull', '--rebase', '--autostash', '-q', 'origin', 'main'], { timeout: 10 * M });
if (!publish(L, ROOT, ['data', 'docs'], `data: hourly local refresh ${new Date().toISOString().slice(0, 16)}Z`, ['HEAD:gh-pages'])) failed++;
L.say(`hourly done (${failed} failing step${failed === 1 ? '' : 's'})`);
process.exit(failed ? 1 : 0);
