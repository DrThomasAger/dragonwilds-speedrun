// Shared search, repo listing, and Smile linter bridge for Smile CLI & MCP server.
// Portable across PCs: auto-discovers D:\projects or C:\Users\hanjo\Claude\Projects, and merges live local Antigravity transcripts with sangha-vault/agents.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, OUT, TEMP_ROOT, HOME, readJSON, exists, iso, trunc } from './lib.mjs';

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
  path.join(HOME, 'Claude', 'Projects'),
  path.join(HOME, 'projects'),
], 'D:\\projects');

export const SMILE_REPO_DIR = firstExisting([
  process.env.SMILE_REPO_DIR,
  path.join(PROJECTS_DIR, 'Smile-Prompt-Language'),
  path.join(HOME, 'Claude', 'Projects', 'Smile'),
  path.join(HOME, 'Claude', 'Projects', 'smile'),
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
  path.join(HOME, 'Claude', 'Projects', 'V1CT0RY', 'V1CT0R10U5', 'From GitHub', 'sangha-vault'),
], path.join(PROJECTS_DIR, 'sangha-vault'));

export const BB_EXE = firstExisting([
  process.env.BB_EXE,
  'D:\\scoop\\shims\\bb.exe',
  path.join(HOME, 'scoop', 'shims', 'bb.exe'),
  path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Babashka.Babashka_Microsoft.Winget.Source_8wekyb3d8bbwe', 'bb.exe'),
  path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'bb.exe'),
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

let _localAgyCache = null;
let _localPiCache = null;

function walkJsonlFiles(dir) {
  const out = [];
  if (!exists(dir)) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJsonlFiles(p));
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function parseLocalPiSession(sfile, surface) {
  let raw;
  try { raw = fs.readFileSync(sfile, 'utf8'); } catch { return null; }
  const turns = [];
  let sid = path.basename(sfile, '.jsonl');
  let cwd = surface;
  let model = surface === 'opencode-session' ? 'opencode' : 'pi-coding-agent';
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    if (r.type === 'session') {
      if (r.id) sid = r.id;
      if (r.cwd) cwd = r.cwd;
    } else if (r.type === 'model_change' && r.modelId) {
      model = r.provider ? `${r.provider}/${r.modelId}` : r.modelId;
    } else if (r.type === 'message' && r.message) {
      const m = r.message;
      const role = m.role;
      const t = iso(r.timestamp || m.timestamp);
      const c = m.content;
      const txt = typeof c === 'string'
        ? c.trim()
        : Array.isArray(c)
          ? c.map(b => typeof b === 'string' ? b : (b?.text || '')).join('\n').trim()
          : '';
      if (txt && (role === 'user' || role === 'assistant')) {
        turns.push({ role, t, text: trunc(txt) });
      }
    }
  }
  if (!turns.length) return null;
  const firstUser = turns.find(t => t.role === 'user');
  const started = turns.find(t => t.t)?.t || null;
  const ended = [...turns].reverse().find(t => t.t)?.t || null;
  return {
    source: surface,
    model,
    id: sid,
    file: `__local_pi__:${sfile}`,
    title: (firstUser?.text || sid).replace(/\s+/g, ' ').slice(0, 80),
    project: cwd,
    started,
    ended,
    turnsCount: turns.length,
    turnsData: turns,
  };
}

function getLocalPiConversations(existingIds) {
  if (!_localPiCache) {
    const found = [];
    const seenIds = new Set();
    const roots = [
      { dir: path.join(HOME, '.pi', 'agent', 'sessions'), surface: 'pi-session' },
      { dir: path.join(HOME, 'Claude', 'Projects', 'Ganapati', 'sessions'), surface: 'pi-session' },
      { dir: path.join(HOME, '.local', 'share', 'opencode', 'sessions'), surface: 'opencode-session' },
    ];
    for (const { dir, surface } of roots) {
      for (const sfile of walkJsonlFiles(dir)) {
        const parsed = parseLocalPiSession(sfile, surface);
        if (parsed && !seenIds.has(parsed.id)) {
          seenIds.add(parsed.id);
          found.push(parsed);
        }
      }
    }
    _localPiCache = found;
  }
  return _localPiCache.filter(c => !existingIds.has(c.id));
}

function parseLocalAntigravityTranscript(tfile, convId, surface) {
  let raw;
  try { raw = fs.readFileSync(tfile, 'utf8'); } catch { return null; }
  const turns = [];
  const tools = {};
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    const t = iso(r.created_at);
    if (r.type === 'USER_INPUT' && typeof r.content === 'string') {
      const m = r.content.match(/<USER_REQUEST>\r?\n?([\s\S]*?)\r?\n?<\/USER_REQUEST>/);
      const txt = (m ? m[1] : r.content).trim();
      if (txt) turns.push({ role: 'user', t, text: trunc(txt) });
    } else if (r.type === 'PLANNER_RESPONSE') {
      if (typeof r.content === 'string' && r.content.trim()) {
        turns.push({ role: 'assistant', t, text: trunc(r.content.trim()) });
      }
      for (const tc of r.tool_calls || []) {
        const nm = tc.name || 'tool';
        tools[nm] = (tools[nm] || 0) + 1;
        const argStr = JSON.stringify(tc.args || {}).slice(0, 260);
        turns.push({ role: 'tool', t, text: `${nm}: ${argStr}`, name: nm });
      }
    }
  }
  if (!turns.length) return null;
  const firstUser = turns.find(t => t.role === 'user');
  const started = turns.find(t => t.t)?.t || null;
  const ended = [...turns].reverse().find(t => t.t)?.t || null;
  return {
    source: surface,
    model: 'gemini-antigravity',
    id: convId,
    file: `__local_agy__:${tfile}`,
    title: (firstUser?.text || convId).replace(/\s+/g, ' ').slice(0, 80),
    project: surface,
    started,
    ended,
    turnsCount: turns.length,
    turnsData: turns,
  };
}

function getLocalAntigravityConversations(existingIds) {
  if (!_localAgyCache) {
    const found = [];
    const agBrainDirs = [
      { dir: path.join(HOME, '.gemini', 'antigravity', 'brain'), surface: 'antigravity' },
      { dir: path.join(HOME, '.gemini', 'antigravity-cli', 'brain'), surface: 'antigravity-cli' },
    ];
    for (const { dir, surface } of agBrainDirs) {
      if (!exists(dir)) continue;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const d of entries) {
        if (!d.isDirectory()) continue;
        const tf = path.join(dir, d.name, '.system_generated', 'logs', 'transcript_full.jsonl');
        const tc = path.join(dir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
        const useFile = exists(tf) ? tf : exists(tc) ? tc : null;
        if (!useFile) continue;
        const parsed = parseLocalAntigravityTranscript(useFile, d.name, surface);
        if (parsed) found.push(parsed);
      }
    }
    _localAgyCache = found;
  }
  return _localAgyCache.filter(c => !existingIds.has(c.id));
}

function loadIndex() {
  const kb = resolveKbDir();
  const p = path.join(kb, 'index.json');
  const base = exists(p) ? readJSON(p) : { total: 0, bySource: {}, conversations: [] };
  const existingIds = new Set((base.conversations || []).map(c => c.id));
  const localAgy = getLocalAntigravityConversations(existingIds);
  for (const c of localAgy) existingIds.add(c.id);
  const localPi = getLocalPiConversations(existingIds);
  const localAll = [...localAgy, ...localPi];
  if (!localAll.length) return base;
  const bySource = { ...(base.bySource || {}) };
  const extraMeta = localAll.map(c => {
    bySource[c.source] = (bySource[c.source] || 0) + 1;
    return {
      file: c.file,
      source: c.source,
      model: c.model,
      id: c.id,
      title: c.title,
      started: c.started,
      ended: c.ended,
      project: c.project,
      turns: c.turnsCount,
    };
  });
  return {
    ...base,
    total: (base.total || 0) + extraMeta.length,
    bySource,
    conversations: [...(base.conversations || []), ...extraMeta],
  };
}

function readConvData(convDir, meta) {
  const fstr = String(meta.file || '');
  if (fstr.startsWith('__local_agy__:') || fstr.startsWith('__local_pi__:')) {
    const pool = fstr.startsWith('__local_agy__:') ? (_localAgyCache || []) : (_localPiCache || []);
    const localHit = pool.find(c => c.id === meta.id);
    if (localHit) {
      return {
        source: localHit.source,
        model: localHit.model,
        id: localHit.id,
        title: localHit.title,
        started: localHit.started,
        ended: localHit.ended,
        project: localHit.project,
        turns: localHit.turnsData,
      };
    }
    return null;
  }
  const fpath = path.join(convDir, meta.file);
  if (!exists(fpath)) return null;
  try { return readJSON(fpath); } catch { return null; }
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
  if (!filter || filter === 'all' || typeof filter !== 'string') return true;
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

    let conv = null;
    if (String(meta.file || '').startsWith('__local_agy__:') || String(meta.file || '').startsWith('__local_pi__:')) {
      conv = readConvData(convDir, meta);
      if (!conv) continue;
      const rawLower = JSON.stringify(conv).toLowerCase();
      let allFound = true;
      for (const t of terms) {
        if (!hayMeta.includes(t) && !rawLower.includes(t)) { allFound = false; break; }
      }
      if (!allFound) continue;
    } else {
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
      try { conv = JSON.parse(raw); } catch { continue; }
    }

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
  let hit = idx.conversations.find(c =>
    c.id.toLowerCase() === qLower ||
    c.file.toLowerCase() === qLower ||
    c.file.toLowerCase() === `${qLower}.json` ||
    c.id.toLowerCase().startsWith(qLower)
  );
  if (!hit) {
    const terms = qLower.split(/\s+/).filter(Boolean);
    hit = idx.conversations.find(c => {
      const t = String(c.title || '').toLowerCase();
      return terms.every(w => t.includes(w));
    });
  }
  if (!hit) throw new Error(`No conversation found matching "${q}"`);
  const conv = readConvData(convDir, hit);
  if (!conv) throw new Error(`Conversation file not readable for "${q}"`);
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

export function continueConversation(idOrTitle, { maxTurns = 250 } = {}) {
  const conv = getConversation(idOrTitle, { maxTurns });
  const dt = (conv.ended || conv.started || '').slice(0, 10) || 'date unknown';
  const label = `Chat from ${conv.source}, model ${conv.model || 'unknown'}, project ${conv.project || 'general'}, ${dt}, titled ${conv.title || conv.id}. Carry it on from its last turn as the same assistant, in the same manner, and say which service and account it came from if asked.`;
  const lines = [label, ''];
  for (const t of conv.turns || []) {
    if (t.role === 'tool' || t.role === 'system') continue;
    const stamp = t.t ? `[${t.t.slice(11, 16)}] ` : '';
    const who = t.role === 'user' ? 'Hanjo' : (conv.model || conv.source || 'Assistant');
    lines.push(`${stamp}${who}: ${t.text}`);
    lines.push('');
  }
  if (conv.harvestReport) {
    lines.push(`=== INSTANCE HARVEST REPORT (${conv.harvestReport.label}) ===`);
    lines.push(conv.harvestReport.summary);
  }
  return lines.join('\n');
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
  for (const root of new Set([PROJECTS_DIR, path.join(HOME, 'Claude', 'Projects'), 'D:\\projects', 'D:\\labyrinth\\Github'])) {
    scan(root, 3);
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
