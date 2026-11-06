// Shared search, repo listing, and Smile linter bridge for Smile CLI & MCP server.
// Portable across PCs: auto-discovers D:\projects or sibling project roots, and falls back to sangha-vault/agents when local kb is not yet built.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, OUT, TEMP_ROOT, HOME, readJSON, exists } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function firstExisting(candidates, fallback) {
  for (const c of candidates) {
    if (c && exists(c)) return c;
  }
  return fallback;
}

export const PROJECTS_DIR = firstExisting([
  process.env.SANGHA_PROJECTS_DIR,
  'D:\\projects',
  path.basename(path.resolve(ROOT, '..')).toLowerCase() === 'jagex'
    ? path.resolve(ROOT, '..', '..')
    : path.resolve(ROOT, '..'),
  path.join(HOME, 'projects'),
], 'D:\\projects');

export const SMILE_REPO_DIR = firstExisting([
  process.env.SMILE_REPO_DIR,
  path.join(PROJECTS_DIR, 'Smile-Prompt-Language'),
  'D:\\projects\\Smile-Prompt-Language',
  'D:\\labyrinth\\Github\\Smile-Prompt-Language',
  path.resolve(ROOT, '..', 'Smile-Prompt-Language'),
], path.join(PROJECTS_DIR, 'Smile-Prompt-Language'));

export const SMILE_VSCODE_DIR = path.join(SMILE_REPO_DIR, 'Smile for VS Code');
export const SMILE_LIBRARY_DIR = path.join(SMILE_REPO_DIR, 'Instance Library');

export const VAULT_DIR = firstExisting([
  process.env.SANGHA_VAULT_DIR,
  path.join(PROJECTS_DIR, 'sangha-vault'),
  'D:\\projects\\sangha-vault',
  path.resolve(ROOT, '..', 'sangha-vault'),
], path.join(PROJECTS_DIR, 'sangha-vault'));

export const BB_EXE = firstExisting([
  process.env.BB_EXE,
  'D:\\scoop\\shims\\bb.exe',
  path.join(HOME, 'scoop', 'shims', 'bb.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\bb.exe',
], 'bb');

export const SYNC_REPOS_SCRIPT = firstExisting([
  path.join(HERE, 'sync-all-repos.mjs'),
  'D:\\claude-temp\\sync-all-repos.mjs',
], path.join(HERE, 'sync-all-repos.mjs'));

export const INGEST_SCRIPT = path.join(HERE, 'ingest.mjs');
export const VAULT_SYNC_SCRIPT = path.join(VAULT_DIR, 'sync.mjs');

export function resolveKbDir() {
  if (exists(path.join(OUT, 'index.json'))) return OUT;
  const vaultAgents = path.join(VAULT_DIR, 'agents');
  if (exists(path.join(vaultAgents, 'index.json'))) return vaultAgents;
  return OUT;
}

function loadIndex() {
  const kb = resolveKbDir();
  const p = path.join(kb, 'index.json');
  return exists(p) ? readJSON(p) : { total: 0, bySource: {}, conversations: [] };
}

export function getStats() {
  const kb = resolveKbDir();
  const idx = loadIndex();
  const memPath = path.join(kb, 'memory.json');
  const harvPath = path.join(kb, 'harvests.json');
  const srcPath = path.join(kb, 'sources.json');
  const repoReportPath = path.join(TEMP_ROOT, 'repo-sync-report.json');
  const memCount = exists(memPath) ? (readJSON(memPath).count || 0) : 0;
  const harvCount = exists(harvPath) ? (readJSON(harvPath).count || 0) : 0;
  const srcs = exists(srcPath) ? readJSON(srcPath).sources : [];
  const repoReport = exists(repoReportPath) ? readJSON(repoReportPath) : null;
  const repos = listRepos({ limit: 500 });
  return {
    kbSource: kb,
    generated: idx.generated || null,
    totalConversations: idx.total || 0,
    bySource: idx.bySource || {},
    standingMemoryItems: memCount,
    instanceHarvestReports: harvCount,
    localGitRepos: repos.total,
    lastRepoSync: repoReport ? {
      completedAt: repoReport.completedAt,
      pulledCounts: repoReport.pulledCounts,
      clonedCounts: repoReport.clonedCounts,
      freeSpaceGB: repoReport.freeSpaceGB,
    } : null,
    sources: srcs.map(s => ({ source: s.source, status: s.status, conversations: s.conversations ?? s.files ?? 0, note: s.note })),
  };
}

function matchesSourceFilter(convSource, filter) {
  if (!filter || filter === 'all') return true;
  const f = filter.toLowerCase();
  const s = String(convSource || '').toLowerCase();
  if (f === 'claude') return s.startsWith('claude');
  return s.includes(f);
}

export function searchConversations({ query = '', source = 'all', project = '', role = '', limit = 15 } = {}) {
  const kb = resolveKbDir();
  const convDir = path.join(kb, 'conversations');
  const idx = loadIndex();
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const projFilter = String(project || '').toLowerCase().trim();
  const maxResults = Math.max(1, Math.min(Number(limit) || 15, 100));

  const candidates = idx.conversations.filter(c => {
    if (!matchesSourceFilter(c.source, source)) return false;
    if (projFilter && !String(c.project || '').toLowerCase().includes(projFilter)) return false;
    return true;
  });

  if (!terms.length) {
    const recent = [...candidates].sort((a, b) => String(b.ended || b.started || '').localeCompare(String(a.ended || a.started || ''))).slice(0, maxResults);
    return { totalMatched: candidates.length, returned: recent.length, results: recent };
  }

  const scored = [];
  for (const meta of candidates) {
    const hayMeta = `${meta.title || ''} ${meta.project || ''} ${meta.id || ''} ${meta.source || ''}`.toLowerCase();
    let metaHits = 0;
    for (const t of terms) if (hayMeta.includes(t)) metaHits++;

    const fpath = path.join(convDir, meta.file);
    if (!exists(fpath)) continue;
    let raw;
    try { raw = fs.readFileSync(fpath, 'utf8'); } catch { continue; }
    const rawLower = raw.toLowerCase();
    let allFound = true;
    for (const t of terms) {
      if (!hayMeta.includes(t) && !rawLower.includes(t)) { allFound = false; break; }
    }
    if (!allFound) continue;

    let conv;
    try { conv = JSON.parse(raw); } catch { continue; }
    const snippets = [];
    let turnHits = 0;
    for (const turn of conv.turns || []) {
      if (role && turn.role !== role) continue;
      const tl = String(turn.text || '').toLowerCase();
      let matchedTerm = null;
      for (const t of terms) {
        if (tl.includes(t)) { matchedTerm = t; turnHits++; }
      }
      if (matchedTerm && snippets.length < 3) {
        const pos = tl.indexOf(matchedTerm);
        const start = Math.max(0, pos - 90);
        const excerpt = String(turn.text).slice(start, start + 260).replace(/\s+/g, ' ').trim();
        snippets.push({ role: turn.role, t: turn.t, excerpt: (start > 0 ? '…' : '') + excerpt });
      }
    }
    if (role && !turnHits) continue;
    const score = metaHits * 20 + Math.min(turnHits, 30) + (String(meta.source).startsWith('claude') ? 3 : 0);
    scored.push({
      score,
      id: meta.id,
      file: meta.file,
      source: meta.source,
      model: meta.model,
      project: meta.project,
      title: meta.title,
      started: meta.started,
      ended: meta.ended,
      turns: meta.turns,
      snippets,
    });
  }

  scored.sort((a, b) => b.score - a.score || String(b.ended || b.started || '').localeCompare(String(a.ended || a.started || '')));
  const top = scored.slice(0, maxResults);
  return { totalMatched: scored.length, returned: top.length, results: top };
}

export function getConversation(idOrFile, { maxTurns = 80 } = {}) {
  const q = String(idOrFile || '').trim();
  if (!q) throw new Error('Conversation id is required');
  const kb = resolveKbDir();
  const convDir = path.join(kb, 'conversations');
  const idx = loadIndex();
  const qLower = q.toLowerCase();
  const hit = idx.conversations.find(c =>
    c.id.toLowerCase() === qLower ||
    c.file.toLowerCase() === qLower ||
    c.file.toLowerCase() === `${qLower}.json` ||
    c.id.toLowerCase().startsWith(qLower)
  );
  if (!hit) throw new Error(`No conversation found matching "${q}"`);
  const conv = readJSON(path.join(convDir, hit.file));
  const harvPath = path.join(kb, 'harvests.json');
  let harvest = null;
  if (exists(harvPath)) {
    const hs = readJSON(harvPath).harvests || [];
    harvest = hs.find(h => h.id === hit.id || h.id.startsWith(qLower) || (h.label && h.label.toLowerCase().includes(qLower))) || null;
  }
  const totalTurns = (conv.turns || []).length;
  return {
    ...conv,
    totalTurns,
    turns: (conv.turns || []).slice(0, maxTurns),
    truncatedTurns: totalTurns > maxTurns ? totalTurns - maxTurns : 0,
    ...(harvest ? { harvestReport: harvest } : {}),
  };
}

export function searchMemory({ query = '', limit = 15 } = {}) {
  const kb = resolveKbDir();
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const maxResults = Math.max(1, Math.min(Number(limit) || 15, 60));
  const memPath = path.join(kb, 'memory.json');
  const harvPath = path.join(kb, 'harvests.json');
  const items = [];

  if (exists(memPath)) {
    for (const m of readJSON(memPath).memory || []) {
      items.push({
        kind: m.type || 'memory',
        id: `${m.project}:${m.file}`,
        project: m.project,
        title: m.name || m.file,
        description: m.description || null,
        text: m.body || '',
      });
    }
  }
  if (exists(harvPath)) {
    for (const h of readJSON(harvPath).harvests || []) {
      items.push({
        kind: 'instance-harvest',
        id: h.id,
        project: h.project,
        title: h.agentName ? `${h.label} (${h.agentName})` : h.label,
        description: `Harvested ${h.started || ''}`,
        text: h.summary || '',
      });
    }
  }

  if (!terms.length) return { totalMatched: items.length, returned: Math.min(items.length, maxResults), results: items.slice(0, maxResults) };
  const matched = [];
  for (const it of items) {
    const hay = `${it.title} ${it.project} ${it.description || ''} ${it.text}`.toLowerCase();
    let hits = 0;
    let ok = true;
    for (const t of terms) {
      if (!hay.includes(t)) { ok = false; break; }
      hits += (String(it.title || '').toLowerCase().includes(t) ? 5 : 1);
    }
    if (!ok) continue;
    const pos = it.text.toLowerCase().indexOf(terms[0]);
    const start = pos >= 0 ? Math.max(0, pos - 80) : 0;
    matched.push({
      kind: it.kind,
      id: it.id,
      project: it.project,
      title: it.title,
      description: it.description,
      excerpt: it.text.slice(start, start + 450).trim(),
      score: hits,
    });
  }
  matched.sort((a, b) => b.score - a.score);
  return { totalMatched: matched.length, returned: Math.min(matched.length, maxResults), results: matched.slice(0, maxResults) };
}

export function listRepos({ filter = '', limit = 100 } = {}) {
  const f = String(filter || '').toLowerCase().trim();
  const repos = [];
  const seen = new Set();
  const scan = (root, depth = 2) => {
    if (!root || depth < 0 || !exists(root)) return;
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(root, e.name);
      let lst;
      try { lst = fs.lstatSync(p); } catch { continue; }
      if (lst.isSymbolicLink() || !lst.isDirectory()) continue;
      let real;
      try { real = fs.realpathSync(p).toLowerCase(); } catch { real = p.toLowerCase(); }
      if (exists(path.join(p, '.git')) && !seen.has(real)) {
        seen.add(real);
        let remote = '';
        try {
          const cfg = fs.readFileSync(path.join(p, '.git', 'config'), 'utf8');
          remote = cfg.match(/\[remote "origin"\][\s\S]*?url\s*=\s*([^\r\n]+)/)?.[1]?.trim() || '';
        } catch {}
        if (!f || e.name.toLowerCase().includes(f) || p.toLowerCase().includes(f) || remote.toLowerCase().includes(f)) {
          repos.push({ name: e.name, path: p, remote });
        }
      }
      scan(p, depth - 1);
    }
  };
  for (const root of new Set([PROJECTS_DIR, 'D:\\projects', 'D:\\labyrinth\\Github'])) {
    scan(root, 2);
  }
  repos.sort((a, b) => a.name.localeCompare(b.name));
  return { total: repos.length, returned: Math.min(repos.length, limit), repos: repos.slice(0, limit) };
}

export function smileTask(taskName, args = [], stdinText = null) {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const env = { ...process.env, TEMP: TEMP_ROOT, TMP: TEMP_ROOT };
  let tmpFile = null;
  try {
    const finalArgs = [...args];
    if (stdinText != null) {
      const cliTmp = path.join(TEMP_ROOT, 'smile-cli');
      fs.mkdirSync(cliTmp, { recursive: true });
      tmpFile = path.join(cliTmp, `input-${Date.now()}-${Math.random().toString(36).slice(2)}.smile`);
      fs.writeFileSync(tmpFile, stdinText, 'utf8');
      finalArgs.unshift(tmpFile);
    }
    const out = execFileSync(BB_EXE, [taskName, ...finalArgs], {
      cwd: SMILE_VSCODE_DIR,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: out };
  } catch (e) {
    return {
      ok: false,
      exitCode: e.status ?? 1,
      output: (e.stdout?.toString() || '') + (e.stderr?.toString() || e.message || ''),
    };
  } finally {
    if (tmpFile && exists(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }
}

export function runSync({ repos = true, cloneMissing = false, history = true, vault = true } = {}) {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const env = { ...process.env, TEMP: TEMP_ROOT, TMP: TEMP_ROOT, GIT_LFS_SKIP_SMUDGE: '1' };
  const out = {};
  if (repos && exists(SYNC_REPOS_SCRIPT)) {
    const syncArgs = [SYNC_REPOS_SCRIPT, ...(cloneMissing ? ['--clone-missing'] : [])];
    out.repos = execFileSync('node', syncArgs, { env, encoding: 'utf8', timeout: 600000 }).trim().split('\n').slice(-5).join('\n');
  }
  if (history && exists(INGEST_SCRIPT)) {
    out.history = execFileSync('node', [INGEST_SCRIPT, '--only=claude,harvests,claudeweb,smile,copilot,others,drive'], { env, encoding: 'utf8', timeout: 300000 }).trim().split('\n').slice(-8).join('\n');
  }
  if (vault && exists(VAULT_SYNC_SCRIPT)) {
    out.vault = execFileSync('node', [VAULT_SYNC_SCRIPT], { cwd: path.dirname(VAULT_SYNC_SCRIPT), env, encoding: 'utf8', timeout: 120000 }).trim();
  }
  return out;
}
