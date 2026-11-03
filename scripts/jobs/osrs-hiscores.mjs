// "OSRS Hiscores" (daily 06:10 + at logon): in D:\labyrinth\Github\osrs-accounts git pull, run
// scripts/refresh-hiscores.mjs (updates <slug>/account.json, ACCOUNT.md, the README table and
// <slug>/logs/hiscores.jsonl), then commit + push if anything changed. Never deletes anything.
// Log: D:\claude-temp\logs\osrs-hiscores-<date>.log
import { logger, step, run, publish, waitForNetwork } from './lib.mjs';

const REPO = 'D:\\labyrinth\\Github\\osrs-accounts';
const L = logger('osrs-hiscores');
L.say(`start (pid ${process.pid})`);
await waitForNetwork(L, 'secure.runescape.com');
let failed = 0;
const pull = run('git', ['pull', '--rebase', '--autostash', '-q', 'origin', 'main'], { cwd: REPO, timeout: 10 * 60 * 1000 });
L.say(`git pull: exit ${pull.status}${pull.status ? ' ' + (pull.stderr || '').slice(0, 300) : ''}`);
if (pull.status) failed++;
if (!step(L, 'refresh hiscores', 'node', ['scripts/refresh-hiscores.mjs'], { cwd: REPO, timeout: 15 * 60 * 1000 }).ok) failed++;
if (!publish(L, REPO, ['.'], `stats: hiscores refresh ${new Date().toISOString().slice(0, 16)}Z`)) failed++;
L.say('done');
process.exit(failed ? 1 : 0);
