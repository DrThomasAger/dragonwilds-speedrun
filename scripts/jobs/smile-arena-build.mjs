// "SMILE Arena Build" (hourly at :35): pull, build the site data, commit + push if changed.
// The repo's GitHub Action (pages.yml) then publishes the site.
// Log: D:\claude-temp\logs\smile-arena-build-<date>.log
import { existsSync, readFileSync } from 'node:fs';
import { logger, step, run, publish } from './lib.mjs';

const REPO = 'D:\\labyrinth\\Github\\smile-arena';
const L = logger('smile-arena-build');
L.say('start');
let failed = 0;
const pull = run('git', ['pull', '--rebase', '--autostash', '-q', 'origin', 'main'], { cwd: REPO, timeout: 10 * 60 * 1000 });
L.say(`git pull: exit ${pull.status}${pull.status ? ' ' + (pull.stderr || '').slice(0, 300) : ''}`);
if (pull.status) failed++;

const pkg = existsSync(`${REPO}\\package.json`) ? JSON.parse(readFileSync(`${REPO}\\package.json`, 'utf8')) : {};
if (pkg.scripts?.['build:site']) {
  if (!step(L, 'npm run build:site', 'npm', ['run', 'build:site'], { cwd: REPO, timeout: 30 * 60 * 1000, shell: true }).ok) failed++;
} else L.say('no build:site script, skipping build');

// Everything not ignored, minus Python bytecode caches.
if (!publish(L, REPO, ['.', ':(exclude)**/__pycache__/**'], `site: hourly local build ${new Date().toISOString().slice(0, 16)}Z`)) failed++;
L.say('done');
process.exit(failed ? 1 : 0);
