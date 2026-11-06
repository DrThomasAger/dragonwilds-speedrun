// Parallel GitHub repo sync (fetch + pull --ff-only).
// Pass --clone-missing on a machine with plenty of disk space to also clone missing GitHub repos.
// Uses in-memory Authorization header from `git credential fill` — never writes tokens to disk or C:.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { TEMP_ROOT, PROJECTS_DIR } from './search-lib.mjs';

fs.mkdirSync(TEMP_ROOT, { recursive: true });
process.env.TEMP = TEMP_ROOT;
process.env.TMP = TEMP_ROOT;
process.env.TMPDIR = TEMP_ROOT.replace(/\\/g, '/');
process.env.GIT_LFS_SKIP_SMUDGE = '1';
process.env.GIT_TERMINAL_PROMPT = '0';

const CLONE_MISSING = process.argv.includes('--clone-missing');
const PULL_CONCURRENCY = 6;
const CLONE_CONCURRENCY = 3;

function getToken() {
  const cred = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  return cred.match(/^password=(.+)$/m)?.[1]?.trim();
}

const TOKEN = getToken();
const BASIC = TOKEN ? Buffer.from(`x-access-token:${TOKEN}`).toString('base64') : '';
const GIT_FLAGS = [
  ...(BASIC ? ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${BASIC}`, '-c', 'credential.helper='] : []),
  '-c', 'pack.threads=1',
  '-c', 'pack.windowMemory=16m',
  '-c', 'http.lowSpeedLimit=1000',
  '-c', 'http.lowSpeedTime=20',
];

function runGit(args, cwd, timeoutMs = 90000) {
  return new Promise(resolve => {
    let p;
    try {
      p = spawn('git', [...GIT_FLAGS, ...args], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (e) {
      return resolve({ code: 1, out: '', err: `spawn: ${e.message}` });
    }
    let out = '', err = '';
    const timer = setTimeout(() => { try { p.kill(); } catch {} resolve({ code: 124, out, err: 'timeout' }); }, timeoutMs);
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (err += d));
    p.on('close', code => { clearTimeout(timer); resolve({ code: code ?? 1, out: out.trim(), err: err.trim() }); });
    p.on('error', e => { clearTimeout(timer); resolve({ code: 1, out: '', err: e.message }); });
  });
}

async function pool(items, concurrency, fn) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}

function freeGB(dir = PROJECTS_DIR) {
  try {
    const root = path.parse(path.resolve(dir)).root;
    const st = fs.statfsSync(root);
    return (Number(st.bavail) * Number(st.bsize)) / (1024 ** 3);
  } catch {
    return 99;
  }
}

async function fetchAllGitHubRepos() {
  if (!TOKEN) return [];
  const pages = await Promise.all([1, 2, 3].map(page =>
    fetch(`https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&page=${page}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'smile-cli-repo-sync' },
    }).then(r => r.json()).catch(() => [])
  ));
  return pages.flat().filter(r => r && r.full_name);
}

function scanLocalGitDirs() {
  const gitDirs = [];
  const seenReal = new Set();
  const walk = (dir, depth = 2) => {
    if (!dir || depth < 0 || !fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      let lst;
      try { lst = fs.lstatSync(p); } catch { continue; }
      if (lst.isSymbolicLink() || !lst.isDirectory()) continue;
      let real;
      try { real = fs.realpathSync(p).toLowerCase(); } catch { real = p.toLowerCase(); }
      if (fs.existsSync(path.join(p, '.git'))) {
        if (!seenReal.has(real)) {
          seenReal.add(real);
          let url = '';
          try {
            const cfg = fs.readFileSync(path.join(p, '.git', 'config'), 'utf8');
            url = cfg.match(/\[remote "origin"\][\s\S]*?url\s*=\s*([^\r\n]+)/)?.[1]?.trim() || '';
          } catch {}
          gitDirs.push({ path: p, url });
        }
      }
      walk(p, depth - 1);
    }
  };
  for (const root of new Set([PROJECTS_DIR, 'D:\\projects', 'D:\\labyrinth\\Github'])) {
    walk(root, 2);
  }
  return gitDirs;
}

async function pullRepo(g) {
  if (!g.url) return { path: g.path, status: 'no-remote' };
  const f = await runGit(['fetch', '--all', '--prune', '--quiet'], g.path);
  if (f.code !== 0) return { path: g.path, status: 'fetch-error', detail: f.err.slice(0, 160) };
  const up = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], g.path, 15000);
  if (up.code !== 0 || !up.out) return { path: g.path, status: 'fetched-no-upstream' };
  const cnt = await runGit(['rev-list', '--left-right', '--count', `HEAD...${up.out}`], g.path, 15000);
  const [ahead, behind] = cnt.out.split(/\s+/).map(Number);
  if (!behind) return { path: g.path, status: 'up-to-date', ahead: ahead || 0 };
  const pl = await runGit(['pull', '--ff-only', '--quiet'], g.path);
  if (pl.code === 0) {
    console.log(`[pull] +${behind} commits: ${g.path}`);
    return { path: g.path, status: 'pulled', commitsPulled: behind };
  }
  return { path: g.path, status: 'fetched-needs-manual-merge', behind, detail: pl.err.slice(0, 160) };
}

async function cloneRepo(r) {
  const free = freeGB();
  if (free < 5.0) return { repo: r.full_name, status: 'skipped-low-disk', freeGB: Number(free.toFixed(2)) };
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const safeName = r.name === '.claude' ? 'dot-claude' : r.name;
  let target = path.join(PROJECTS_DIR, safeName);
  if (fs.existsSync(target)) {
    target = path.join(PROJECTS_DIR, `${r.owner.login}--${safeName}`);
  }
  if (fs.existsSync(target)) return { repo: r.full_name, path: target, status: 'already-exists' };
  const cl = await runGit(['clone', '--filter=blob:none', '--quiet', r.clone_url, target], PROJECTS_DIR, 180000);
  if (cl.code === 0) {
    console.log(`[clone] OK: ${r.full_name} -> ${target} (free ${freeGB().toFixed(2)} GB)`);
    return { repo: r.full_name, path: target, status: 'cloned' };
  }
  if (fs.existsSync(target) && !fs.existsSync(path.join(target, '.git'))) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
  return { repo: r.full_name, path: target, status: 'error', detail: cl.err.slice(0, 160) };
}

async function main() {
  const t0 = Date.now();
  const localDirs = scanLocalGitDirs();
  const ghRepos = CLONE_MISSING ? await fetchAllGitHubRepos() : [];
  console.log(`[repo-sync] local=${localDirs.length}, cloneMissing=${CLONE_MISSING}, free=${freeGB().toFixed(2)} GB`);

  const pullResults = await pool(localDirs, PULL_CONCURRENCY, pullRepo);
  let cloneResults = [];
  if (CLONE_MISSING && ghRepos.length) {
    const byFull = new Map(), byRepoName = new Map();
    for (const g of localDirs) {
      const m = g.url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
      if (m) {
        byFull.set(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`, g);
        const rn = m[2].toLowerCase();
        if (!byRepoName.has(rn)) byRepoName.set(rn, []);
        byRepoName.get(rn).push(g);
      }
    }
    const missing = ghRepos.filter(r => {
      const full = r.full_name.toLowerCase();
      const repo = r.name.toLowerCase();
      return !(byFull.get(full) || (r.owner.login.toLowerCase() === 'drthomasager' && byRepoName.get(repo)?.[0]));
    });
    cloneResults = await pool(missing, CLONE_CONCURRENCY, cloneRepo);
  }

  const summary = {
    completedAt: new Date().toISOString(),
    elapsedSec: Number(((Date.now() - t0) / 1000).toFixed(1)),
    freeSpaceGB: Number(freeGB().toFixed(2)),
    localBefore: localDirs.length,
    pulledCounts: pullResults.reduce((acc, x) => ((acc[x.status] = (acc[x.status] || 0) + 1), acc), {}),
    clonedCounts: cloneResults.reduce((acc, x) => ((acc[x.status] = (acc[x.status] || 0) + 1), acc), {}),
    pulledRepos: pullResults.filter(x => x.status === 'pulled' || x.status === 'fetched-needs-manual-merge' || x.status === 'fetch-error'),
    cloneResults,
  };
  fs.writeFileSync(path.join(TEMP_ROOT, 'repo-sync-report.json'), JSON.stringify(summary, null, 2));
  console.log('[done]', JSON.stringify({ elapsedSec: summary.elapsedSec, freeSpaceGB: summary.freeSpaceGB, pulledCounts: summary.pulledCounts, clonedCounts: summary.clonedCounts }));
}

main().catch(e => { console.error(e); process.exit(1); });
