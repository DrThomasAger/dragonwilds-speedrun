#!/usr/bin/env node
// Sangha History & Smile MCP Server (zero-dependency JSON-RPC 2.0 over stdio).
// Exposes all ingested Claude / Claude Code / Instance Harvest / ChatGPT / Antigravity / Smile conversations,
// standing memory, local GitHub repositories, and Smile Prompt Language lint/mend tools.
import {
  getStats, searchConversations, getConversation, continueConversation, searchMemory, listRepos, smileTask, runSync,
} from './search-lib.mjs';

const TOOLS = [
  {
    name: 'conversation_stats',
    description: 'Return counts and status across all ingested AI conversation sources (Claude Code, Subagents, Instance Harvests, Prompt History, ChatGPT, Antigravity, Gemini CLI, Smile Chat, Drive) and local GitHub repositories.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => getStats(),
  },
  {
    name: 'search_conversations',
    description: 'Full-text and metadata search across all Claude Code, Claude Harvest, ChatGPT, Antigravity, Gemini CLI, and Smile Chat conversations. Returns matching conversation metadata and timestamped turn excerpts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search across titles, project names, and conversation turns (leave empty for most recent).' },
        source: { type: 'string', description: 'Optional source filter: all, claude, claude-code, claude-code-harvest, claude-code-subagent, chatgpt, antigravity, gemini-cli, smile-chat, drive.' },
        project: { type: 'string', description: 'Optional project name substring (e.g. osrs, smile, amenti, dragonwilds).' },
        role: { type: 'string', description: 'Optional turn role filter: user, assistant, tool, agent.' },
        limit: { type: 'number', description: 'Max conversations to return (default 15, max 100).' },
      },
    },
    handler: async (args = {}) => searchConversations(args),
  },
  {
    name: 'get_conversation',
    description: 'Fetch the full normalised transcript (turns) and Instance Harvest report (if available) for a conversation by ID, filename, or title words.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation ID (full or prefix), filename, or title words from search_conversations.' },
        maxTurns: { type: 'number', description: 'Maximum turns to return (default 80).' },
      },
      required: ['id'],
    },
    handler: async ({ id, maxTurns = 80 } = {}) => getConversation(id, { maxTurns }),
  },
  {
    name: 'continue_conversation',
    description: 'Return a conversation formatted with its origin label line (service, model, project, date, title) followed by its verbatim turns and harvest report, ready to continue.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation ID (full or prefix), filename, or title words.' },
        maxTurns: { type: 'number', description: 'Maximum turns to include (default 250).' },
      },
      required: ['id'],
    },
    handler: async ({ id, maxTurns = 250 } = {}) => continueConversation(id, { maxTurns }),
  },
  {
    name: 'search_standing_memory',
    description: 'Search standing agent instructions (CLAUDE.md, custom-prompt.md, project memory/*.md, slash commands) and the Instance Harvest requirement/learning reports.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search in standing memories and harvest reports.' },
        limit: { type: 'number', description: 'Max results to return (default 15).' },
      },
    },
    handler: async (args = {}) => searchMemory(args),
  },
  {
    name: 'list_github_repos',
    description: 'List or filter all local GitHub repositories cloned on this PC.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional substring filter on repo name, path, or remote URL.' },
        limit: { type: 'number', description: 'Max repos to return (default 100).' },
      },
    },
    handler: async (args = {}) => listRepos(args),
  },
  {
    name: 'smile_lint',
    description: 'Lint Smile Prompt Language text using the canonical Smile checker (Smile for VS Code). Returns diagnostics or "Every face meets the conventions."',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Smile text content to lint (or omit if filePath is provided).' },
        filePath: { type: 'string', description: 'Path to an existing .smile or .md file to lint.' },
      },
    },
    handler: async ({ text, filePath } = {}) => {
      if (filePath) return smileTask('lint', [filePath]);
      if (typeof text === 'string') return smileTask('lint', [], text);
      throw new Error('Provide either text or filePath');
    },
  },
  {
    name: 'smile_mend',
    description: 'Auto-mend Smile Prompt Language text (indentation, labels, outer gratitude) without changing a single word.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Smile text content to mend and return.' },
        filePath: { type: 'string', description: 'Optional file path to mend in place.' },
      },
    },
    handler: async ({ text, filePath } = {}) => {
      if (filePath) return smileTask('mend', [filePath]);
      if (typeof text === 'string') return smileTask('mend', ['--print'], text);
      throw new Error('Provide either text or filePath');
    },
  },
  {
    name: 'sync_repos_and_history',
    description: 'Pull/clone GitHub repos, re-ingest conversation histories, and refresh sangha-vault.',
    inputSchema: {
      type: 'object',
      properties: {
        repos: { type: 'boolean', description: 'Pull/clone GitHub repos (default false unless requested).' },
        history: { type: 'boolean', description: 'Re-run conversation history ingest (default true).' },
        vault: { type: 'boolean', description: 'Refresh sangha-vault copies (default false).' },
      },
    },
    handler: async ({ repos = false, history = true, vault = false } = {}) => runSync({ repos, history, vault }),
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  if (id === undefined) return; // notification (e.g. notifications/initialized)

  try {
    if (method === 'initialize') {
      return send({
        jsonrpc: '20',
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'sangha-history', version: '1.1.0' },
        },
      });
    }
    if (method === 'ping') {
      return send({ jsonrpc: '2.0', id, result: {} });
    }
    if (method === 'tools/list') {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        },
      });
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find(t => t.name === params?.name);
      if (!tool) {
        return send({
          jsonrpc: '2.0',
          id,
          result: { isError: true, content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }] },
        });
      }
      const out = await tool.handler(params?.arguments || {});
      return send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] },
      });
    }
    if (method === 'resources/list') {
      return send({ jsonrpc: '2.0', id, result: { resources: [] } });
    }
    if (method === 'prompts/list') {
      return send({ jsonrpc: '2.0', id, result: { prompts: [] } });
    }
    return send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (e) {
    return send({
      jsonrpc: '2.0',
      id,
      result: { isError: true, content: [{ type: 'text', text: String(e?.message || e) }] },
    });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line || line.startsWith('Content-Length:')) continue;
    try {
      const parsed = JSON.parse(line);
      handleMessage(parsed);
    } catch {}
  }
});
