// Agent Observatory ingest: find every AI/agent conversation, normalise it, write
// data/kb/agents/conversations/<source>-<id>.json + index.json + sources.json + memory.json + harvests.json.
// Read-only on all sources. Usage: node scripts/agents/ingest.mjs [--only=claude,harvests,chatgpt,...]
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
const globalClaudeSessionIds = new Set();
const log = (...a) => console.log('[ingest]', ...a);

const CLAUDE_ROOTS = [
  path.join(HOME, '.claude'),
  'D:\\projects\\dot-claude',
  'D:\\labyrinth\\Exports\\claude-code-projects',
];

function ls(dir) { try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; } }
function readLines(f) {
  if (!exists(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function projectFromDir(d) { return d.replace(/^([A-Z])--/, '$1:\\').replace(/-/g, '\\'); }

// ---------------------------------------------------------------- Claude Code (local ~/.claude + dot-claude repo)
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
function parseClaudeFile(file, { subagent = false, parent = null, project, originRoot = null }) {
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
      ...(originRoot ? { originRoot } : {}),
      ...(parent ? { parent } : {}),
      ...(subagent ? { agentType: meta.agentType || null, spawnDepth: meta.spawnDepth ?? null } : {}),
      ...(firstUser && /^You are the Raid Lab/.test(firstUser.text) ? { automated: true } : {}),
    },
  };
}

function ingestClaude() {
  const bestMain = new Map();
  const bestSub = new Map();
  const activeRoots = CLAUDE_ROOTS.filter(exists);

  for (const root of activeRoots) {
    const pdir = exists(path.join(root, 'projects')) ? path.join(root, 'projects') : root;
    for (const d of ls(pdir)) {
      if (!d.isDirectory()) continue;
      const dir = path.join(pdir, d.name);
      const project = projectFromDir(d.name);
      for (const f of ls(dir)) {
        if (f.isFile() && f.name.endsWith('.jsonl')) {
          const conv = parseClaudeFile(path.join(dir, f.name), { project, originRoot: root });
          globalClaudeSessionIds.add(conv.id);
          if (conv.turns.length) {
            const prev = bestMain.get(conv.id);
            if (!prev || conv.turns.length > prev.turns.length) bestMain.set(conv.id, conv);
          }
        } else if (f.isDirectory()) {
          const sdir = path.join(dir, f.name, 'subagents');
          for (const s of ls(sdir)) {
            if (!s.name.endsWith('.jsonl')) continue;
            const conv = parseClaudeFile(path.join(sdir, s.name), { subagent: true, parent: `claude-code-${f.name}`, project, originRoot: root });
            const key = `${f.name}-${conv.id}`;
            if (conv.turns.length) {
              const prev = bestSub.get(key);
              if (!prev || conv.turns.length > prev.turns.length) bestSub.set(key, { ...conv, id: key });
            }
          }
        }
      }
    }
  }
  for (const conv of bestMain.values()) index.push(saveConversation(conv));
  for (const conv of bestSub.values()) index.push(saveConversation(conv));
  sources.push({ source: 'claude-code', location: activeRoots.map(r => path.join(r, 'projects')).join(' | '), status: 'ingested', conversations: bestMain.size });
  sources.push({ source: 'claude-code-subagent', location: activeRoots.map(r => `${r}\\projects\\*\\<session>\\subagents`).join(' | '), status: 'ingested', conversations: bestSub.size });
  log('claude-code', bestMain.size, 'sessions;', bestSub.size, 'subagents');

  // Also check which session IDs exist in Instance Harvest so prompt-only history doesn't duplicate full harvested dialogues.
  const harvestDir = 'D:\\projects\\Smile-Prompt-Language\\Instance Harvest\\harvests';
  const harvestSessionIds = new Set();
  for (const d of ls(harvestDir)) {
    if (!d.isDirectory()) continue;
    const sj = path.join(harvestDir, d.name, 'source.json');
    if (exists(sj)) {
      try { const s = readJSON(sj); if (s.session_id) harvestSessionIds.add(s.session_id); } catch {}
    }
  }

  // Prompt history across all roots: sessions whose transcript & harvest no longer exist become user-only conversations.
  const bySession = new Map();
  let prompts = 0;
  const seenPromptKey = new Set();
  const histPaths = activeRoots.map(r => path.join(r, 'history.jsonl')).filter(exists);
  for (const hist of histPaths) {
    for (const e of readLines(hist)) {
      const pkey = `${e.sessionId || ''}|${e.timestamp || ''}|${(e.display || '').slice(0, 120)}`;
      if (seenPromptKey.has(pkey)) continue;
      seenPromptKey.add(pkey);
      prompts++;
      const sid = e.sessionId || `nosession-${e.project}`;
      if (!bySession.has(sid)) bySession.set(sid, { project: e.project, rows: [] });
      bySession.get(sid).rows.push(e);
    }
  }
  let hconv = 0;
  for (const [sid, { project, rows }] of bySession) {
    if (globalClaudeSessionIds.has(sid) || harvestSessionIds.has(sid)) continue;
    rows.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const turns = rows.map(e => ({ role: 'user', t: iso(e.timestamp), text: e.display || '' }));
    const conv = {
      source: 'claude-code-history', model: 'claude (transcript not retained)', id: sid, project,
      title: (rows[0]?.display || '').slice(0, 80), turns, extra: { userOnly: true },
    };
    index.push(saveConversation(conv)); hconv++;
  }
  sources.push({ source: 'claude-code-history', location: histPaths.join(' | '), status: 'ingested', conversations: hconv, prompts, sessions: bySession.size,
    note: 'Prompt history only (no AI replies). Sessions that already have a full transcript or Instance Harvest dialogue are skipped here to avoid duplicates.' });
  log('claude-code-history', hconv, 'sessions without transcript,', prompts, 'prompts');

  // Memory folders + CLAUDE.md + custom-prompt.md + commands: what the agents were told to remember (standing instructions).
  const memory = [];
  const seenMem = new Set();
  for (const root of activeRoots) {
    const pdir = path.join(root, 'projects');
    for (const d of ls(pdir)) {
      const mdir = path.join(pdir, d.name, 'memory');
      for (const f of ls(mdir)) {
        if (!f.name.endsWith('.md')) continue;
        const fp = path.join(mdir, f.name);
        const txt = fs.readFileSync(fp, 'utf8');
        const key = `${d.name}/${f.name}/${txt.length}`;
        if (seenMem.has(key)) continue;
        seenMem.add(key);
        const fm = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const get = k => fm?.[1].match(new RegExp(`^\\s*${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1] || null;
        memory.push({ project: projectFromDir(d.name), file: f.name, origin: root, name: get('name'), description: get('description'),
          type: get('type') || 'project-memory', modified: get('modified'), body: trunc(txt.replace(/^---[\s\S]*?---\r?\n/, ''), 4000) });
      }
    }
    for (const topFile of ['CLAUDE.md', 'custom-prompt.md']) {
      const fp = path.join(root, topFile);
      if (exists(fp)) {
        const txt = fs.readFileSync(fp, 'utf8');
        memory.push({ project: 'global', file: topFile, origin: root, name: topFile, description: `Global ${topFile} from ${root}`, type: 'global-instructions', body: trunc(txt, 6000) });
      }
    }
    const cdir = path.join(root, 'commands');
    for (const f of ls(cdir)) {
      if (!f.name.endsWith('.md')) continue;
      const txt = fs.readFileSync(path.join(cdir, f.name), 'utf8');
      memory.push({ project: 'global-commands', file: f.name, origin: root, name: `/${path.basename(f.name, '.md')}`, description: 'Claude slash command', type: 'command', body: trunc(txt, 4000) });
    }
  }
  writeJSON(path.join(OUT, 'memory.json'), { generated: new Date().toISOString(), count: memory.length, memory }, true);
  sources.push({ source: 'claude-code-memory', location: activeRoots.join(' | '), status: 'ingested', files: memory.length,
    note: 'Saved to memory.json (standing instructions, CLAUDE.md, custom-prompt.md, and slash commands).' });
}

// ---------------------------------------------------------------- Instance Harvest (449 harvested Claude Code chats)
function parseHarvestDialogue(dialogueFile, statementsFile) {
  const stmts = new Map();
  for (const s of readLines(statementsFile)) {
    if (s.number != null) stmts.set(Number(s.number), s);
  }
  if (!exists(dialogueFile)) {
    return [...stmts.values()].map(s => ({ role: 'user', t: iso(s.timestamp), text: s.words || '' }));
  }
  const raw = fs.readFileSync(dialogueFile, 'utf8');
  const parts = raw.split(/\r?\n## Statement (\d+) \(([^,)]+),\s*([^)]+)\)\r?\n/);
  // parts[0] is header, then [num, kind, ts, body, num, kind, ts, body, ...]
  const turns = [];
  for (let i = 1; i < parts.length; i += 4) {
    const num = Number(parts[i]);
    const ts = iso(parts[i + 2]?.trim()) || iso(stmts.get(num)?.timestamp);
    const body = parts[i + 3] || '';
    const replyMarker = new RegExp(`\\r?\\n### The instance's spoken reply after statement ${num}\\r?\\n`);
    const [uPart, aPart] = body.split(replyMarker);
    const uText = (stmts.get(num)?.words ?? uPart ?? '').trim();
    if (uText) turns.push({ role: 'user', t: ts, text: uText });
    if (aPart) {
      const cleanA = aPart.trim();
      if (cleanA && cleanA !== '(no spoken reply before his next statement)') {
        turns.push({ role: 'assistant', t: ts, text: cleanA });
      }
    }
  }
  return turns;
}

function ingestHarvests() {
  const root = 'D:\\projects\\Smile-Prompt-Language\\Instance Harvest\\harvests';
  if (!exists(root)) {
    sources.push({ source: 'claude-code-harvest', location: root, status: 'not-found', conversations: 0 });
    return;
  }
  let n = 0, skippedDup = 0;
  const harvestSummaries = [];
  for (const d of ls(root)) {
    if (!d.isDirectory()) continue;
    const dir = path.join(root, d.name);
    const sjPath = path.join(dir, 'source.json');
    let meta = {};
    if (exists(sjPath)) { try { meta = readJSON(sjPath); } catch {} }
    const sid = meta.session_id || d.name;
    const hFile = path.join(dir, 'harvest.md');
    const hText = exists(hFile) ? fs.readFileSync(hFile, 'utf8') : '';
    if (hText) {
      harvestSummaries.push({
        id: sid,
        label: meta.label || d.name,
        project: meta.project || null,
        agentName: meta.agent_name || null,
        started: iso(meta.started),
        ended: iso(meta.last_statement),
        commands: meta.commands_used || [],
        summary: trunc(hText, 4000),
      });
    }
    // Skip creating a duplicate conversation if raw .jsonl was already ingested
    if (globalClaudeSessionIds.has(sid)) { skippedDup++; continue; }
    const turns = parseHarvestDialogue(path.join(dir, 'dialogue.md'), path.join(dir, 'statements.jsonl'));
    if (!turns.length) continue;
    const firstUser = turns.find(t => t.role === 'user');
    index.push(saveConversation({
      source: 'claude-code-harvest',
      model: 'claude (instance-harvest)',
      id: sid,
      project: meta.project || d.name.split(' ')[0],
      title: meta.agent_name ? `${meta.agent_name}: ${(firstUser?.text || '').slice(0, 60)}` : (firstUser?.text || d.name).slice(0, 80),
      started: iso(meta.started),
      ended: iso(meta.last_statement),
      turns,
      extra: {
        harvestLabel: meta.label || d.name,
        agentName: meta.agent_name || null,
        commandsUsed: meta.commands_used || [],
        hasHarvestReport: Boolean(hText),
      },
    }));
    n++;
  }
  writeJSON(path.join(OUT, 'harvests.json'), { generated: new Date().toISOString(), count: harvestSummaries.length, harvests: harvestSummaries }, true);
  sources.push({
    source: 'claude-code-harvest',
    location: root,
    status: 'ingested',
    conversations: n,
    alreadyInRawJsonl: skippedDup,
    harvestReports: harvestSummaries.length,
    note: 'Full user+assistant dialogues preserved by Instance Harvest from prior Claude Code sessions, plus harvest reports in harvests.json.',
  });
  log('claude-code-harvest', n, 'new dialogues,', skippedDup, 'already in raw jsonl,', harvestSummaries.length, 'harvest reports');
}

// ---------------------------------------------------------------- Claude.ai web exports (if exported to disk)
function ingestClaudeWeb() {
  const roots = ['D:\\labyrinth\\Exports\\claude-ai', 'D:\\Exports\\claude-ai', 'D:\\projects\\data_liberation', 'D:\\projects\\ai-friends'];
  const files = [...new Set(roots.filter(exists).flatMap(r => findFiles(r, 'conversations.json', 5)))];
  let n = 0;
  for (const f of files) {
    let arr;
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    if (!Array.isArray(arr) || !arr.length || !arr[0]?.chat_messages) continue; // distinguish from ChatGPT conversations.json
    for (const c of arr) {
      const turns = (c.chat_messages || []).map(m => ({
        role: m.sender === 'human' ? 'user' : 'assistant',
        t: iso(m.created_at),
        text: m.text || (Array.isArray(m.content) ? m.content.map(p => p.text || '').join('\n') : ''),
      })).filter(t => t.text && t.text.trim());
      if (!turns.length) continue;
      index.push(saveConversation({
        source: 'claude-web',
        model: 'claude.ai',
        id: c.uuid || c.id,
        title: c.name || turns[0]?.text?.slice(0, 80),
        project: 'claude.ai',
        started: iso(c.created_at),
        ended: iso(c.updated_at),
        turns,
      }));
      n++;
    }
  }
  sources.push({
    source: 'claude-web',
    location: n ? files.join(' | ') : 'claude.ai account (D:\\labyrinth\\Exports\\claude-ai)',
    status: n ? 'ingested' : 'needs-user-export',
    conversations: n,
    note: n ? undefined : 'claude.ai web/desktop chats live on Anthropic servers until exported via claude.ai -> Settings -> Privacy -> Export data.',
  });
}

// ---------------------------------------------------------------- ChatGPT / OpenAI exports
const OPENAI_ROOTS = [
  'D:\\projects\\OpenSophia\\OpenSophia\\data_exports',
  'D:\\projects\\OpenAIDataExportTransformer\\exports',
  'D:\\projects\\SophiaEmergentAGI',
  'D:\\projects\\Archive',
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
    if (!Array.isArray(arr) || (arr[0] && arr[0].chat_messages && !arr[0].mapping)) continue;
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

// ---------------------------------------------------------------- Smile Chat local receipts
function ingestSmileReceipts() {
  const dir = 'D:\\projects\\Smile-Prompt-Language\\Smile Chat\\Chat Receipts';
  if (!exists(dir)) {
    sources.push({ source: 'smile-chat', location: dir, status: 'not-found', conversations: 0 });
    return;
  }
  let n = 0;
  for (const f of ls(dir)) {
    if (!f.isFile() || !f.name.endsWith('.txt')) continue;
    const raw = fs.readFileSync(path.join(dir, f.name), 'utf8');
    const turns = [];
    const dm = f.name.match(/^(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})\s+(.*)\.txt$/);
    const ts = dm ? iso(`${dm[1]}T${dm[2]}:${dm[3]}:${dm[4]}Z`) : null;
    const title = dm ? dm[5] : path.basename(f.name, '.txt');
    const re = /<\|im_start\|>(system|user|assistant)\r?\n([\s\S]*?)(?:<\|im_end\|>|$)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const role = m[1];
      const text = m[2].replace(/<think>\s*<\/think>\s*/g, '').trim();
      if (text) turns.push({ role, t: ts, text });
    }
    if (!turns.some(t => t.role === 'user' || t.role === 'assistant')) continue;
    index.push(saveConversation({
      source: 'smile-chat',
      model: 'smile-local-llm',
      id: path.basename(f.name, '.txt'),
      title,
      project: 'Smile Chat',
      started: ts,
      ended: ts,
      turns,
    }));
    n++;
  }
  sources.push({ source: 'smile-chat', location: dir, status: n ? 'ingested' : 'found-empty', conversations: n });
  log('smile-chat', n, 'receipts');
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

// ---------------------------------------------------------------- Antigravity IDE & CLI / Gemini CLI / Cursor / LM Studio
function parseAntigravityTranscript(tfile, convId, surface) {
  const rows = readLines(tfile);
  const turns = [];
  const tools = {};
  for (const r of rows) {
    const t = iso(r.created_at);
    if (r.type === 'USER_INPUT' && typeof r.content === 'string') {
      const m = r.content.match(/<USER_REQUEST>\r?\n?([\s\S]*?)\r?\n?<\/USER_REQUEST>/);
      const txt = (m ? m[1] : r.content).trim();
      if (txt) turns.push({ role: 'user', t, text: txt });
    } else if (r.type === 'PLANNER_RESPONSE') {
      if (typeof r.content === 'string' && r.content.trim()) {
        turns.push({ role: 'assistant', t, text: r.content.trim() });
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
  return {
    source: surface,
    model: 'gemini-antigravity',
    id: convId,
    title: (firstUser?.text || convId).slice(0, 80),
    project: surface,
    turns,
    extra: { tools },
  };
}

function ingestOthers() {
  // Antigravity IDE + Antigravity CLI brain transcripts
  const agBrainDirs = [
    { dir: path.join(HOME, '.gemini', 'antigravity', 'brain'), surface: 'antigravity' },
    { dir: path.join(HOME, '.gemini', 'antigravity-cli', 'brain'), surface: 'antigravity-cli' },
  ];
  let agCount = 0;
  for (const { dir, surface } of agBrainDirs) {
    for (const d of ls(dir)) {
      if (!d.isDirectory()) continue;
      const tf = path.join(dir, d.name, '.system_generated', 'logs', 'transcript_full.jsonl');
      const tc = path.join(dir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      const useFile = exists(tf) ? tf : exists(tc) ? tc : null;
      if (!useFile) continue;
      const conv = parseAntigravityTranscript(useFile, d.name, surface);
      if (conv) { index.push(saveConversation(conv)); agCount++; }
    }
  }
  sources.push({
    source: 'antigravity',
    location: agBrainDirs.map(x => x.dir).join(' ; '),
    status: agCount ? 'ingested' : 'found-empty',
    conversations: agCount,
  });
  log('antigravity', agCount, 'conversations');

  // Gemini CLI
  const gemRoots = [path.join(HOME, '.gemini', 'tmp'), 'D:\\claude-temp\\gemini-tmp', path.join('D:\\claude-temp', '.gemini', 'tmp')];
  const gemChats = gemRoots.flatMap(gemTmp => ls(gemTmp).flatMap(d => ls(path.join(gemTmp, d.name, 'chats')).map(f => path.join(gemTmp, d.name, 'chats', f.name))));
  let gn = 0;
  for (const f of gemChats) {
    try {
      const j = readJSON(f);
      const turns = (j.messages || []).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', t: iso(m.timestamp), text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
      if (turns.length) { index.push(saveConversation({ source: 'gemini-cli', model: 'gemini', id: j.sessionId || path.basename(f, '.json'), turns, project: j.projectHash })); gn++; }
    } catch {}
  }
  sources.push({ source: 'gemini-cli', location: gemRoots.join(' | '), status: gn ? 'ingested' : 'ready', conversations: gn,
    note: gn ? undefined : 'Gemini CLI installed and configured; new sessions under ~/.gemini/tmp/*/chats will be ingested automatically.' });
  sources.push({ source: 'gemini-web', location: 'Google account (gemini.google.com)', status: 'needs-user-export', conversations: 0,
    note: 'No Takeout / My Activity export on D: yet. See docs/agents/HOW-TO-EXPORT.md.' });
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
  sources.push({ source: 'lmstudio', location: lms.join(' ; '), status: ln ? 'ingested' : 'not-found', conversations: ln });
  // SillyTavern
  const st = 'D:\\projects\\SillyTavern';
  sources.push({ source: 'sillytavern', location: st, status: 'found-empty', conversations: 0 });
  sources.push({ source: 'codex-cli', location: path.join(HOME, '.codex'), status: exists(path.join(HOME, '.codex')) ? 'found-unparsed' : 'not-found', conversations: 0 });
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
const steps = {
  claude: ingestClaude,
  harvests: ingestHarvests,
  claudeweb: ingestClaudeWeb,
  chatgpt: ingestChatGPT,
  smile: ingestSmileReceipts,
  copilot: ingestCopilot,
  others: ingestOthers,
  drive: ingestDrive,
};
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
