// "RaidLab Daily Review" (daily 04:30): full review backlog, analysis, KB rebuild,
// Playwright tests (summary in the log), then commit + push data/ and docs/ (main and gh-pages).
// Log: D:\claude-temp\logs\daily-review-<date>.log
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger, step, run, publish, ROOT } from './lib.mjs';

const L = logger('daily-review');
L.say('start');
const H = 60 * 60 * 1000;
const STEPS = [
  ['review backlog (full, every pending source)', ['node', 'scripts/review/run.mjs', '--jobs=3'], 6 * H],
  ['analysis', ['node', '--max-old-space-size=4096', 'scripts/analysis/run-all.mjs'], 2 * H],
  ['knowledge base', ['node', 'scripts/build-kb.mjs'], 1 * H],
];
let failed = 0;
for (const [name, cmd, timeout] of STEPS) {
  if (!existsSync(join(ROOT, cmd.find(a => a.startsWith('scripts/'))))) { L.say(`skip ${name}: not built yet`); continue; }
  if (!step(L, name, cmd[0], cmd.slice(1), { timeout }).ok) failed++;
}

// Playwright: headless (config default), summary lines only.
const t = Date.now();
const pw = run('npx', ['playwright', 'test', '--reporter=line'], { timeout: 1 * H, shell: true });
const out = (pw.stdout || '') + (pw.stderr || '');
const summary = out.split(/\r?\n/).filter(l => /\b(passed|failed|flaky|skipped|did not run)\b/.test(l) && /^\s*\d+ /.test(l));
const fails = out.split(/\r?\n/).filter(l => /^\s*\d+\) /.test(l)).slice(0, 30);
L.say(`playwright: exit ${pw.status} in ${((Date.now() - t) / 1000).toFixed(0)} s; ${summary.map(s => s.trim()).join(', ') || 'no summary line'}`);
for (const f of fails) L.raw('  ' + f.trim());
if (pw.status !== 0) failed++;

run('git', ['pull', '--rebase', '--autostash', '-q', 'origin', 'main'], { timeout: 10 * 60 * 1000 });
if (!publish(L, ROOT, ['data', 'docs'], `data: daily local review ${new Date().toISOString().slice(0, 16)}Z`, ['HEAD:gh-pages'])) failed++;
L.say(`done (${failed} failing step${failed === 1 ? '' : 's'})`);
process.exit(failed ? 1 : 0);
