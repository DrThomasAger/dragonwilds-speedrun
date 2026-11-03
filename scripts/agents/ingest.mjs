// Agent Observatory ingest: find every AI/agent conversation, normalise it, write
// data/kb/agents/conversations/<source>-<id>.json + index.json + sources.json + memory.json.
// Read-only on all sources. Usage: node scripts/agents/ingest.mjs [--only=claude,chatgpt,...]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  OUT, CONV_DIR, SCRATCH, HOME, ensureDirs, writeJSON, readJSON, exists, iso, trunc, saveConversation,
} from './lib.mjs';

const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = s => !only.length || only.includes(s);
ensureDirs();

const indexPath = path.join(OUT, 'index.json');
const sourcesPath = path.join(OUT, 'sources.json');
// When running a subset, keep the other sources' entries from the previous run.
const prevIndex = only.length && exists(indexPath) ? readJSON(indexPath).conversations : [];
const prevSources = only.length && exists(sourcesPath) ? readJSON(sourcesPath).sources : [];
const index = [];
const sources = [];
const log = (...a) => console.log('[ingest]', ...a);

const CLAUDE = path.join(HOME, '.claude');
const PROJECTS = path.join(CLAUDE, 'projects');

function ls(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }
function readLines(f) {
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function projectFromDir(d) { return d.replace(/^([A-Z])--/, '$1:\\').replace(/-/g, '\\'); }

// ---------------------------------------------------------------- Claude Code
function toolSummary(p) {
  const i = p.input || {};
  const s = i.description || i.command || i.file_path || i.pattern || i.query || i.url || i.prompt || i.skill || JSON.stringify(i);
  return `${p.name}: ${String(s).slice(0, 300)}`;
}
function classifyUserText(x, meta) {
  if (meta) return 'system';
  const s = x.trimStart();
  if (s.startsWith('[Request interrupted')) return 'system';
  if (/^<(task-notification|local-command|system-reminder|bash-|user-memory)/.test(s)) return 'system';
  if (s.startsWith('Caveat:')) return 'system';
  return 'user';
}
function parseClaudeFile(file, { subagent = false, parent = null, project }) {
  const rows = readLines(file);
  const turns = [];
  const models = {};
  const tools = {};
  const seenUser = new Set();
  let title = null, sessionId = null, cwd = null;
  for (const e of rows) {
    if (e.sessionId && !sessionId) sessionId = e.sessionId;
    if (e.cwd && !cwd) cwd = e.cwd;
    if (e.type === 'ai-title' && e.aiTitle) title = e.aiTitle;
    if (e.type === 'summary' && e.summary && !title) title = e.summary;
    const t = iso(e.timestamp);
    if (e.type === 'attachment' && e.attachment?.type === 'queued_command' && typeof e.attachment.prompt === 'string') {
      const txt = e.attachment.prompt.trim();
      if (txt && !txt.startsWith('<task-notification') && !seenUser.has(txt)) {
        seenUser.add(txt); turns.push({ role: subagent ? 'agent' : 'user', t, text: txt, name: 'queued' });
      }
      continue;
    }
    if (e.type === 'user') {
      const c = e.message?.content;
      if (Array.isArray(c)) {
        for (const p of c) {
          if (p.type === 'tool_result' && p.is_error) {
            const txt = typeof p.content === 'string' ? p.content : (p.content || []).map(q => q.text || '').join('\n');
            turns.push({ role: 'tool_error', t, text: txt.slice(0, 600) || '[tool error]' });
          }
        }
        const txt = c.filter(p => p.type === 'text').map(p => p.text).join('\n').trim();
        if (txt) {
          let role = classifyUserText(txt, e.isMeta);
          if (role === 'user' && subagent) role = 'agent';
          if (role !== 'user' || !seenUser.has(txt)) { seenUser.add(txt); turns.push({ role, t, text: txt }); }
        }
      } else if (typeof c === 'string' && c.trim()) {
        let role = classifyUserText(c, e.isMeta);
        if (role === 'user' && subagent) role = 'agent';
        const cmd = c.match(/<command-name>([^<]*)<\/command-name>[\s\S]*?(?:<command-args>([^<]*)<\/command-args>)?/);
        const txt = cmd ? `[CMD] ${cmd[1]} ${cmd[2] || ''}`.trim() : c.trim();
        if (cmd) role = subagent ? 'agent' : 'user';
        if (role !== 'user' || !seenUser.has(txt)) { seenUser.add(txt); turns.push({ role, t, text: txt }); }
      }
    } else if (e.type === 'assistant') {
      const m = e.message || {};
      if (m.model && m.model !== '<synthetic>') models[m.model] = (models[m.model] || 0) + 1;
      for (const p of Array.isArray(m.content) ? m.content : []) {
        if (p.type === 'text' && p.text?.trim()) turns.push({ role: 'assistant', t, text: p.text });
        else if (p.type === 'tool_use') {
          tools[p.name] = (tools[p.name] || 0) + 1;
          turns.push({ role: 'tool', t, text: toolSummary(p), name: p.name });
        }
      }
    }
  }
  const model = Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const firstUser = turns.find(t => t.role === 'user' || t.role === 'agent');
  const id = subagent ? path.basename(file, '.jsonl') : (sessionId || path.basename(file, '.jsonl'));
  let meta = {};
  if (subagent) { try { meta = readJSON(file.replace(/\.jsonl$/, '.meta.json')); } catch {} }
  return {
    source: subagent ? 'claude-code-subagent' : 'claude-code',
    model, id, project: cwd || project,
    title: (subagent && meta.description) || title || (firstUser ? firstUser.text.slice(0, 80) : null),
    turns,
    extra: {
      models, tools,
      ...(parent ? { parent } : {}),
      ...(subagent ? { agentType: meta.agentType || null, spawnDepth: meta.spawnDepth ?? null } : {}),
      ...(firstUser && /^You are the Raid Lab/.test(firstUser.text) ? { automated: true } : {}),
    },
  };
}

function ingestClaude() {
  let main = 0, sub = 0;
  const sessionIds = new Set();
  for (const d of ls(PROJECTS)) {
    if (!d.isDirectory()) continue;
    const dir = path.join(PROJECTS, d.name);
    const project = projectFromDir(d.name);
    for (const f of ls(dir)) {
      if (f.isFile() && f.name.endsWith('.jsonl')) {
        const conv = parseClaudeFile(path.join(dir, f.name), { project });
        sessionIds.add(conv.id);
        if (conv.turns.length) { index.push(saveConversation(conv)); main++; }
      } else if (f.isDirectory()) {
        const sdir = path.join(dir, f.name, 'subagents');
        for (const s of ls(sdir)) {
          if (!s.name.endsWith('.jsonl')) continue;
          const conv = parseClaudeFile(path.join(sdir, s.name), { subagent: true, parent: `claude-code-${f.name}`, project });
          if (conv.turns.length) { index.push(saveConversation(conv)); sub++; }
        }
      }
    }
  }
  sources.push({ source: 'claude-code', location: PROJECTS, status: 'ingested', conversations: main });
  sources.push({ source: 'claude-code-subagent', location: `${PROJECTS}\\*\\<session>\\subagents`, status: 'ingested', conversations: sub });
  log('claude-code', main, 'sessions;', sub, 'subagents');

  // Prompt history: sessions whose transcript no longer exists become user-only conversations.
  const hist = path.join(CLAUDE, 'history.jsonl');
  const bySession = new Map();
  let prompts = 0;
  for (const e of readLines(hist)) {
    prompts++;
    const sid = e.sessionId || `nosession-${e.project}`;
    if (!bySession.has(sid)) bySession.set(sid, { project: e.project, rows: [] });
    bySession.get(sid).rows.push(e);
  }
  let hconv = 0;
  for (const [sid, { project, rows }] of bySession) {
    if (sessionIds.has(sid)) continue;
    const turns = rows.map(e => ({ role: 'user', t: iso(e.timestamp), text: e.display || '' }));
    const conv = {
      source: 'claude-code-history', model: 'claude (transcript not retained)', id: sid, project,
      title: (rows[0]?.display || '').slice(0, 80), turns, extra: { userOnly: true },
    };
    index.push(saveConversation(conv)); hconv++;
  }
  sources.push({ source: 'claude-code-history', location: hist, status: 'ingested', conversations: hconv, prompts, sessions: bySession.size,
    note: 'Prompt history only (no AI replies). Sessions that still have a transcript are skipped here to avoid duplicates.' });
  log('claude-code-history', hconv, 'sessions without transcript,', prompts, 'prompts');

  // Memory folders: what the agents were told to remember (standing instructions).
  const memory = [];
  for (const d of ls(PROJECTS)) {
    const mdir = path.join(PROJECTS, d.name, 'memory');
    for (const f of ls(mdir)) {
      if (!f.name.endsWith('.md')) continue;
      const txt = fs.readFileSync(path.join(mdir, f.name), 'utf8');
      const fm = txt.match(/^---\n([\s\S]*?)\n---/);
      const get = k => fm?.[1].match(new RegExp(`^\\s*${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1] || null;
      memory.push({ project: projectFromDir(d.name), file: f.name, name: get('name'), description: get('description'),
        type: get('type'), modified: get('modified'), body: trunc(txt.replace(/^---[\s\S]*?---\n/, ''), 4000) });
    }
  }
  writeJSON(path.join(OUT, 'memory.json'), { generated: new Date().toISOString(), count: memory.length, memory }, true);
  sources.push({ source: 'claude-code-memory', location: `${PROJECTS}\\*\\memory`, status: 'ingested', files: memory.length,
    note: 'Saved to memory.json (standing instructions, not conversations).' });
}

// ---------------------------------------------------------------- ChatGPT / OpenAI exports
const OPENAI_ROOTS = [
  'D:\\labyrinth\\Github\\OpenSophia\\OpenSophia\\data_exports',
  'D:\\labyrinth\\Github\\OpenAIDataExportTransformer\\exports',
  'D:\\labyrinth\\SophiaEmergentAGI',
  'D:\\labyrinth\\Archive',
  'D:\\Consolidated Exports\\01 ChatGPT exports',
];
const ACCOUNT_BY_HASH = { '29fd9696': 'hanjoyoutaku', '83e8151a': 'crystallizationculture', '92b1f199': 'hanjopurebuddha' };
function accountFor(p) {
  const s = p.toLowerCase();
  for (const [h, a] of Object.entries(ACCOUNT_BY_HASH)) if (s.includes(h)) return a;
  if (/opensophia\\data_exports\\1\\/.test(s)) return 'hanjoyoutaku';
  if (/opensophia\\data_exports\\2\\/.test(s)) return 'crystallizationculture';
  if (/opensophia\\data_exports\\3\\/.test(s)) return 'hanjopurebuddha';
  if (/\\cryst(allizationculture)?\\/.test(s)) return 'crystallizationculture';
  if (s.includes('\\hanjoyoutaku\\')) return 'hanjoyoutaku';
  if (s.includes('\\hanjopurebuddha\\')) return 'hanjopurebuddha';
  return null;
}
function findFiles(root, name, depth = 9, out = []) {
  if (depth < 0) return out;
  for (const e of ls(root)) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git$/.test(e.name)) findFiles(p, name, depth - 1, out); }
    else if (e.name === name) out.push(p);
  }
  return out;
}
function md5(f) { return crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); }
function partsText(content) {
  if (!content) return '';
  if (Array.isArray(content.parts)) return content.parts.map(p => typeof p === 'string' ? p : (p?.text || (p?.content_type ? `[${p.content_type}]` : ''))).join('\n');
  if (typeof content.text === 'string') return content.text;
  if (typeof content.result === 'string') return content.result;
  return '';
}
function ingestChatGPT() {
  const files = [...new Set(OPENAI_ROOTS.flatMap(r => findFiles(r, 'conversations.json')))];
  const byHash = new Map();
  for (const f of files) {
    const st = fs.statSync(f); if (st.size < 3) continue;
    const h = md5(f); if (!byHash.has(h)) byHash.set(h, f);
  }
  log('chatgpt', files.length, 'conversations.json files,', byHash.size, 'unique');
  const best = new Map(); // conv id -> {conv, nodes, account}
  const accountById = new Map();
  for (const f of byHash.values()) {
    let arr;
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { log('skip', f, e.message); continue; }
    if (!Array.isArray(arr)) continue;
    const acct = accountFor(f);
    for (const c of arr) {
      const id = c.id || c.conversation_id; if (!id) continue;
      if (acct && !accountById.has(id)) accountById.set(id, acct);
      const nodes = Object.keys(c.mapping || {}).length;
      const prev = best.get(id);
      if (!prev || nodes > prev.nodes || (nodes === prev.nodes && (c.update_time || 0) > (prev.conv.update_time || 0)))
        best.set(id, { conv: c, nodes, file: f });
    }
    arr = null;
  }
  let n = 0;
  const perAccount = {};
  for (const [id, { conv: c, file }] of best) {
    const m = c.mapping || {};
    // Walk the visible branch from current_node back to root.
    const chain = [];
    let k = c.current_node;
    if (!k || !m[k]) k = Object.keys(m).find(x => !(m[x].children || []).length);
    const guard = new Set();
    while (k && m[k] && !guard.has(k)) { guard.add(k); chain.push(m[k]); k = m[k].parent; }
    chain.reverse();
    const turns = []; const models = {}; const tools = {};
    for (const node of chain) {
      const msg = node.message; if (!msg) continue;
      const role = msg.author?.role;
      const md = msg.metadata || {};
      if (md.is_visually_hidden_from_conversation) continue;
      const text = partsText(msg.content);
      const t = iso(msg.create_time) || iso(c.create_time);
      if (role === 'user') turns.push({ role: 'user', t, text });
      else if (role === 'assistant') {
        if (md.model_slug) models[md.model_slug] = (models[md.model_slug] || 0) + 1;
        const ct = msg.content?.content_type;
        if (ct === 'code' || msg.recipient && msg.recipient !== 'all') {
          const nm = msg.recipient || 'code'; tools[nm] = (tools[nm] || 0) + 1;
          turns.push({ role: 'tool', t, text: `${nm}: ${text.slice(0, 300)}`, name: nm });
        } else turns.push({ role: 'assistant', t, text });
      } else if (role === 'tool') {
        const nm = msg.author?.name || 'tool';
        if (/error|traceback/i.test(text.slice(0, 400)) && msg.content?.content_type === 'execution_output')
          turns.push({ role: 'tool_error', t, text: text.slice(0, 600) });
      } else if (role === 'system' && text.trim() && !md.is_user_system_message) {
        // skip hidden system prompts
      } else if (role === 'system' && md.is_user_system_message) {
        turns.push({ role: 'system', t, text: `[custom instructions] ${text}` });
      }
    }
    if (!turns.some(t => t.role === 'user')) continue;
    const acct = accountById.get(id) || accountFor(file) || 'unknown';
    perAccount[acct] = (perAccount[acct] || 0) + 1;
    const model = Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] || c.default_model_slug || 'chatgpt';
    index.push(saveConversation({
      source: 'chatgpt', model, id, title: c.title, project: `chatgpt:${acct}`,
      started: iso(c.create_time), ended: iso(c.update_time), turns,
      extra: { account: acct, models, tools, gizmo: c.gizmo_id || null },
    }));
    n++;
  }
  sources.push({ source: 'chatgpt', location: OPENAI_ROOTS.join(' | '), status: 'ingested', conversations: n,
    files: files.length, uniqueFiles: byHash.size, perAccount,
    note: 'Deduplicated by conversation id, keeping the copy with the most message nodes. Newest export on disk is Nov 2023.' });
  log('chatgpt', n, 'unique conversations', perAccount);
}

// ---------------------------------------------------------------- VS Code Copilot chat
function ingestCopilot() {
  const base = path.join(HOME, 'AppData', 'Roaming', 'Code', 'User');
  const files = [];
  for (const w of ls(path.join(base, 'workspaceStorage'))) {
    const d = path.join(base, 'workspaceStorage', w.name, 'chatSessions');
    for (const f of ls(d)) if (f.name.endsWith('.json')) files.push(path.join(d, f.name));
  }
  for (const f of ls(path.join(base, 'globalStorage', 'emptyWindowChatSessions'))) files.push(path.join(base, 'globalStorage', 'emptyWindowChatSessions', f.name));
  let n = 0;
  for (const f of files) {
    let j; try { j = readJSON(f); } catch { continue; }
    const turns = [];
    for (const r of j.requests || []) {
      const t = iso(r.timestamp);
      turns.push({ role: 'user', t, text: r.message?.text || '' });
      const resp = (r.response || []).map(x => typeof x.value === 'string' ? x.value : x.value?.value || '').join('');
      turns.push({ role: 'assistant', t, text: resp });
    }
    if (!turns.length) continue;
    index.push(saveConversation({ source: 'vscode-copilot', model: 'github-copilot', id: j.sessionId, title: j.customTitle, turns, started: iso(j.creationDate), ended: iso(j.lastMessageDate) }));
    n++;
  }
  sources.push({ source: 'vscode-copilot', location: `${base}\\{workspaceStorage\\*\\chatSessions,globalStorage\\emptyWindowChatSessions}`,
    status: n ? 'ingested' : 'found-empty', sessionFiles: files.length, conversations: n,
    note: n ? undefined : 'Session files exist but every one has an empty requests[] (Copilot chat opened, never used).' });
}

// ---------------------------------------------------------------- Antigravity IDE / Gemini CLI / Cursor / LM Studio
function sqliteKeys(db, like) {
  // Uses python's sqlite3 in read-only URI mode (no native node module needed).
  const py = `import sqlite3,sys,json\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nprint(json.dumps([[k,len(v or b'')] for k,v in c.execute("select key,value from ItemTable where key like ?",(sys.argv[2],))]))`;
  try { return JSON.parse(execFileSync('python', ['-I', '-c', py, db, like], { encoding: 'utf8' })); } catch { return null; }
}
function ingestOthers() {
  // Antigravity
  const ag = path.join(HOME, 'AppData', 'Roaming', 'Antigravity IDE', 'User');
  const agGlobal = path.join(ag, 'globalStorage', 'state.vscdb');
  const agConvDirs = [path.join(HOME, '.gemini', 'antigravity', 'conversations'), path.join(HOME, '.gemini', 'antigravity-ide', 'conversations'), path.join(HOME, '.gemini', 'antigravity', 'brain')];
  const agFiles = agConvDirs.flatMap(d => ls(d).map(f => path.join(d, f.name)));
  const keys = exists(agGlobal) ? sqliteKeys(agGlobal, '%') : null;
  const traj = keys?.find(k => k[0] === 'antigravityUnifiedStateSync.trajectorySummaries');
  const chatIdx = keys?.find(k => k[0] === 'chat.ChatSessionStore.index');
  sources.push({ source: 'antigravity', location: `${agGlobal} ; ${agConvDirs.join(' ; ')} ; D:\\Antigravity IDE`,
    status: agFiles.length || (traj && traj[1] > 0) ? 'found-unparsed' : 'found-empty', conversations: 0,
    detail: { trajectorySummariesBytes: traj?.[1] ?? null, chatSessionIndexBytes: chatIdx?.[1] ?? null, conversationFiles: agFiles.length },
    note: 'Installed 2026-11-02; trajectorySummaries is empty and chat.ChatSessionStore.index has no entries, ~/.gemini/antigravity/conversations does not exist: no agent conversations yet. Re-run ingest after using the Agent Manager.' });
  // Gemini CLI
  const gem = path.join(HOME, '.gemini');
  const gemTmp = path.join(gem, 'tmp');
  const gemChats = ls(gemTmp).flatMap(d => ls(path.join(gemTmp, d.name, 'chats')).map(f => path.join(gemTmp, d.name, 'chats', f.name)));
  let gn = 0;
  for (const f of gemChats) {
    try {
      const j = readJSON(f);
      const turns = (j.messages || []).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', t: iso(m.timestamp), text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
      if (turns.length) { index.push(saveConversation({ source: 'gemini-cli', model: 'gemini', id: j.sessionId || path.basename(f), turns, project: j.projectHash })); gn++; }
    } catch {}
  }
  sources.push({ source: 'gemini-cli', location: `${gem}\\tmp\\*\\chats`, status: gn ? 'ingested' : 'not-found', conversations: gn,
    note: gn ? undefined : '~/.gemini only holds antigravity-ide migration marker, bin and install.log; Gemini CLI never ran a chat on this machine.' });
  sources.push({ source: 'gemini-web', location: 'Google account (gemini.google.com)', status: 'needs-user-export', conversations: 0,
    note: 'No Takeout / My Activity export on D: and no Gemini chat exports on Drive (Drive "Gemini" folders hold images only). See docs/agents/HOW-TO-EXPORT.md.' });
  // Cursor
  const cur = path.join(HOME, 'AppData', 'Roaming', 'Cursor');
  sources.push({ source: 'cursor', location: cur, status: exists(cur) ? 'found-unparsed' : 'not-found', conversations: 0,
    note: 'Only ~/.cursor-tutor folders exist (tutorial), no Cursor workspaceStorage.' });
  // LM Studio
  const lms = [path.join(HOME, '.lmstudio', 'conversations'), 'D:\\LMStudio\\LM Studio\\conversations', 'D:\\LMStudio\\conversations'];
  const lmsFiles = lms.flatMap(d => ls(d).filter(f => f.name.endsWith('.json')).map(f => path.join(d, f.name)));
  let ln = 0;
  for (const f of lmsFiles) {
    try {
      const j = readJSON(f);
      const turns = (j.messages || []).map(m => {
        const v = m.versions?.[m.currentlySelected ?? 0] || m;
        const text = (v.content || []).map(x => x.text || '').join('') || (v.steps || []).map(s => (s.content || []).map(x => x.text || '').join('')).join('\n');
        return { role: v.role === 'user' ? 'user' : 'assistant', t: null, text };
      });
      if (turns.length) { index.push(saveConversation({ source: 'lmstudio', model: j.lastUsedModel?.identifier || 'local', id: path.basename(f, '.json'), title: j.name, turns, started: iso(j.createdAt) })); ln++; }
    } catch {}
  }
  sources.push({ source: 'lmstudio', location: lms.join(' ; '), status: ln ? 'ingested' : 'not-found', conversations: ln,
    note: ln ? undefined : '~/.lmstudio-home-pointer points at C:\\Users\\Hanjo\\.lmstudio which does not exist; D:\\LMStudio\\LM Studio is empty.' });
  // SillyTavern
  const st = 'D:\\SillyTavern\\SillyTavern';
  sources.push({ source: 'sillytavern', location: st, status: 'found-empty', conversations: 0, note: 'public/chats holds only README.md; no data/ folder.' });
  sources.push({ source: 'codex-cli', location: path.join(HOME, '.codex'), status: exists(path.join(HOME, '.codex')) ? 'found-unparsed' : 'not-found', conversations: 0 });
  sources.push({ source: 'claude-web', location: 'claude.ai account', status: 'needs-user-export', conversations: 0,
    note: 'claude.ai web/desktop chats are server-side; no export on disk. See HOW-TO-EXPORT.md.' });
  sources.push({ source: 'chatgpt-2024+', location: 'chatgpt.com account', status: 'needs-user-export', conversations: 0,
    note: 'Newest ChatGPT export on disk is Nov 2023. See HOW-TO-EXPORT.md.' });
}

// ---------------------------------------------------------------- Drive docs (fetched by an agent into scratch)
const SPEAKER = /^\s*(?:\*\*)?(You|User|Me|Human|Hanjo|Thomas|Tom|ChatGPT|GPT-?4o?|GPT|Assistant|AI|Claude2?|Claude|Gemini|Bard|Sophia|Kimi|Grok)(?:\*\*)?\s*(?:said)?\s*:\s*(.*)$/i;
const HUMAN = /^(you|user|me|human|hanjo|thomas|tom)$/i;
function ingestDrive() {
  const dir = path.join(SCRATCH, 'drive');
  const manifest = path.join(dir, 'manifest.jsonl');
  if (!exists(manifest)) { sources.push({ source: 'drive', location: dir, status: 'not-fetched', conversations: 0 }); return; }
  const seen = new Set(); let n = 0, instr = 0;
  for (const m of readLines(manifest)) {
    if (seen.has(m.id)) continue; seen.add(m.id);
    const f = path.join(dir, `${m.id}.txt`); if (!exists(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    const turns = []; let cur = null;
    for (const line of txt.split(/\r?\n/)) {
      const mm = line.match(SPEAKER);
      if (mm) { cur = { role: HUMAN.test(mm[1]) ? 'user' : 'assistant', t: null, text: mm[2] || '', name: mm[1] }; turns.push(cur); }
      else if (cur) cur.text += '\n' + line;
    }
    const t0 = iso(m.createdTime);
    for (const t of turns) t.t = t0;
    const isChat = m.kind === 'chat-transcript' && turns.filter(t => t.role === 'user').length >= 1 && turns.some(t => t.role === 'assistant');
    const model = /claude/i.test(m.title) ? 'claude (web)' : /gemini/i.test(m.title) ? 'gemini (web)' : /gpt|chatgpt|sophia/i.test(m.title) ? 'chatgpt (web)' : 'unknown';
    if (isChat) {
      index.push(saveConversation({ source: 'drive-chat', model, id: m.id, title: m.title, project: 'drive', started: t0, ended: iso(m.modifiedTime), turns, extra: { url: m.viewUrl } }));
      n++;
    } else {
      // Unstructured doc: keep as a single document turn (instructions are what the user asks agents to follow).
      index.push(saveConversation({ source: m.kind === 'instructions' ? 'drive-instructions' : 'drive-doc', model, id: m.id, title: m.title, project: 'drive',
        started: t0, ended: iso(m.modifiedTime), turns: [{ role: m.kind === 'instructions' ? 'user' : 'system', t: t0, text: txt }], extra: { url: m.viewUrl, document: true } }));
      instr++;
    }
  }
  sources.push({ source: 'drive', location: 'Google Drive (fetched to D:\\claude-temp\\agents\\drive)', status: 'ingested', conversations: n, documents: instr });
}

// ---------------------------------------------------------------- run
const steps = { claude: ingestClaude, chatgpt: ingestChatGPT, copilot: ingestCopilot, others: ingestOthers, drive: ingestDrive };
for (const [k, fn] of Object.entries(steps)) if (want(k)) { const t0 = Date.now(); fn(); log(k, 'done in', ((Date.now() - t0) / 1000).toFixed(1), 's'); }

// Merge with previous entries for sources not re-run.
const ranSources = new Set(sources.map(s => s.source));
const ranConvSources = new Set(index.map(c => c.source));
const finalIndex = [...prevIndex.filter(c => !ranConvSources.has(c.source) && !ranSources.has(c.source)), ...index];
const finalSources = [...prevSources.filter(s => !ranSources.has(s.source)), ...sources];
finalIndex.sort((a, b) => String(a.started).localeCompare(String(b.started)));
// Drop conversation files no longer in the index (only files this script writes).
const keep = new Set(finalIndex.map(c => c.file));
if (!only.length) for (const f of fs.readdirSync(CONV_DIR)) if (!keep.has(f)) fs.unlinkSync(path.join(CONV_DIR, f));
const bySource = {};
for (const c of finalIndex) bySource[c.source] = (bySource[c.source] || 0) + 1;
writeJSON(indexPath, { generated: new Date().toISOString(), total: finalIndex.length, bySource, conversations: finalIndex });
writeJSON(sourcesPath, { generated: new Date().toISOString(), sources: finalSources }, true);
log('index', finalIndex.length, bySource);
