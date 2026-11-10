#!/usr/bin/env node
// Unified Smile CLI (`smile`) — Portable across machines!
// Smile Prompt Language checker + All AI Conversation History + GitHub Repos + Gemini CLI bridge.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const HAS_D = fs.existsSync('D:\\');
const TEMP_DIR = process.env.SMILE_TEMP || (HAS_D ? 'D:\\claude-temp' : path.join(HOME || HERE, '.smile-temp'));
fs.mkdirSync(TEMP_DIR, { recursive: true });
process.env.TEMP = TEMP_DIR;
process.env.TMP = TEMP_DIR;

function firstExisting(candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

const PROJECTS_DIR = firstExisting([
  process.env.SANGHA_PROJECTS_DIR,
  'D:\\projects',
  path.resolve(HERE, '..', '..'),
  path.join(HOME, 'Claude', 'Projects'),
  path.join(HOME, 'projects'),
]) || 'D:\\projects';

const SMILE_REPO_DIR = firstExisting([
  process.env.SMILE_REPO_DIR,
  fs.existsSync(path.join(HERE, '..', 'Smile for VS Code')) ? path.resolve(HERE, '..') : null,
  path.join(PROJECTS_DIR, 'Smile-Prompt-Language'),
  path.join(HOME, 'Claude', 'Projects', 'Smile'),
  path.join(HOME, 'Claude', 'Projects', 'smile'),
  'D:\\projects\\Smile-Prompt-Language',
  'D:\\labyrinth\\Github\\Smile-Prompt-Language',
]) || path.join(PROJECTS_DIR, 'Smile-Prompt-Language');

const SMILE_VSCODE_DIR = path.join(SMILE_REPO_DIR, 'Smile for VS Code');
const SMILE_LIBRARY_DIR = path.join(SMILE_REPO_DIR, 'Instance Library');
const BB_EXE = firstExisting([
  process.env.BB_EXE,
  'D:\\scoop\\shims\\bb.exe',
  path.join(HOME, 'scoop', 'shims', 'bb.exe'),
  path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'Babashka.Babashka_Microsoft.Winget.Source_8wekyb3d8bbwe', 'bb.exe'),
  path.join(HOME, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'bb.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\bb.exe',
]) || 'bb';

async function loadSearchLib() {
  const candidate = firstExisting([
    path.join(HERE, 'search-lib.mjs'),
    path.join(PROJECTS_DIR, 'dragonwilds-speedrun', 'scripts', 'agents', 'search-lib.mjs'),
    path.join(PROJECTS_DIR, 'JaGeX', 'dragonwilds-speedrun', 'scripts', 'agents', 'search-lib.mjs'),
    path.join(HOME, 'Claude', 'Projects', 'V1CT0RY', 'V1CT0R10U5', 'From GitHub', 'dragonwilds-speedrun', 'scripts', 'agents', 'search-lib.mjs'),
    'D:\\labyrinth\\Github\\JaGeX\\dragonwilds-speedrun\\scripts\\agents\\search-lib.mjs',
  ]);
  if (!candidate) {
    console.error(
      'Sangha history module not found yet.\n' +
      'Run `pwsh setup-smile-cli.ps1` (or clone DrThomasAger/dragonwilds-speedrun + DrThomasAger/sangha-vault into your projects folder).'
    );
    process.exit(1);
  }
  return import(pathToFileURL(candidate).href);
}

const args = process.argv.slice(2);
const cmd = (args[0] || 'help').toLowerCase();
const rest = args.slice(1);

function parseFlags(arr) {
  const flags = {};
  const positional = [];
  for (const a of arr) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else flags[a.slice(2)] = true;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function runBbTask(task, rawArgs) {
  if (!fs.existsSync(SMILE_VSCODE_DIR)) {
    console.error(`Smile checker folder not found at: ${SMILE_VSCODE_DIR}\nClone DrThomasAger/Smile-Prompt-Language or set SMILE_REPO_DIR.`);
    process.exit(1);
  }
  const resolvedArgs = [...rawArgs];
  if ((task === 'lint' || task === 'mend') && resolvedArgs[0] && !resolvedArgs[0].startsWith('-')) {
    resolvedArgs[0] = path.resolve(process.cwd(), resolvedArgs[0]);
  }
  const r = spawnSync(BB_EXE, [task, ...resolvedArgs], {
    cwd: SMILE_VSCODE_DIR,
    stdio: 'inherit',
    env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  if (r.error) {
    console.error(`Failed to run Babashka (${BB_EXE}): ${r.error.message}\nInstall Babashka via \`scoop install babashka\` or \`winget install borkdude.babashka\`.`);
    process.exit(1);
  }
  process.exit(r.status ?? 0);
}

if (['lint', 'mend', 'footer', 'clip', 'report', 'serve', 'test'].includes(cmd)) {
  runBbTask(cmd, rest);
}

if (cmd === 'library' || cmd === 'instances') {
  const sub = rest[0] || 'ask';
  const subArgs = rest.slice(1);
  const dbPath = process.env.INSTANCE_LIBRARY_DB || path.join(TEMP_DIR, 'instance-library', 'library.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const r = spawnSync(BB_EXE, [sub, ...subArgs], {
    cwd: SMILE_LIBRARY_DIR,
    stdio: 'inherit',
    env: { ...process.env, INSTANCE_LIBRARY_DB: dbPath, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  process.exit(r.status ?? 0);
}

const { flags, positional } = parseFlags(rest);

if (cmd === 'stats' || cmd === 'status' || cmd === 'convos') {
  const { getStats } = await loadSearchLib();
  const s = getStats();
  if (flags.json) {
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.log(`=== Sangha & Smile Archive ===`);
    console.log(`Archive source      : ${s.kbSource}`);
    console.log(`Total conversations : ${s.totalConversations}`);
    for (const [src, cnt] of Object.entries(s.bySource)) {
      console.log(`  ${src.padEnd(22)} : ${cnt}`);
    }
    console.log(`Standing memories   : ${s.standingMemoryItems}`);
    console.log(`Instance harvests   : ${s.instanceHarvestReports}`);
    console.log(`Local GitHub repos  : ${s.localGitRepos}`);
    if (s.lastRepoSync) {
      console.log(`Last GitHub sync    : ${s.lastRepoSync.completedAt} (free ${s.lastRepoSync.freeSpaceGB} GB)`);
    }
  }
  process.exit(0);
}

if (cmd === 'search' || cmd === 'history') {
  const { searchConversations } = await loadSearchLib();
  const query = positional.join(' ');
  const res = searchConversations({
    query,
    source: flags.source || 'all',
    project: flags.project || '',
    role: flags.role || '',
    limit: Number(flags.limit || 15),
  });
  if (flags.json) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`Matched ${res.totalMatched} conversation(s) (showing ${res.returned}):\n`);
    for (const r of res.results) {
      const dt = (r.ended || r.started || '').slice(0, 10) || 'no-date';
      console.log(`[${r.source}] ${r.id}  (${dt})  project=${r.project || '-'}`);
      if (r.title) console.log(`  Title: ${r.title}`);
      for (const sn of r.snippets || []) {
        console.log(`  (${sn.role}) ${sn.excerpt}`);
      }
      console.log('');
    }
  }
  process.exit(0);
}

if (cmd === 'chat' || cmd === 'show') {
  const { getConversation } = await loadSearchLib();
  const id = positional.join(' ');
  if (!id) {
    console.error('Usage: smile chat <conversation-id-or-title> [--max-turns=80] [--json]');
    process.exit(1);
  }
  const conv = getConversation(id, { maxTurns: Number(flags['max-turns'] || flags.limit || 80) });
  if (flags.json) {
    console.log(JSON.stringify(conv, null, 2));
  } else {
    console.log(`=== ${conv.title || conv.id} ===`);
    console.log(`ID: ${conv.id} | Source: ${conv.source} | Model: ${conv.model || '-'} | Project: ${conv.project || '-'}`);
    console.log(`Started: ${conv.started || '-'} | Ended: ${conv.ended || '-'} | Turns: ${conv.totalTurns}\n`);
    for (const t of conv.turns || []) {
      const ts = t.t ? ` [${t.t.slice(0, 19).replace('T', ' ')}]` : '';
      console.log(`--- ${t.role.toUpperCase()}${ts} ---`);
      console.log(t.text);
      console.log('');
    }
    if (conv.truncatedTurns) {
      console.log(`... (${conv.truncatedTurns} more turns; pass --max-turns=500 to view more)`);
    }
    if (conv.harvestReport) {
      console.log(`=== INSTANCE HARVEST REPORT (${conv.harvestReport.label}) ===`);
      console.log(conv.harvestReport.summary);
    }
  }
  process.exit(0);
}

if (cmd === 'continue') {
  const { continueConversation } = await loadSearchLib();
  const id = positional.join(' ');
  if (!id) {
    console.error('Usage: smile continue <conversation-id-or-title> [--max-turns=250]');
    process.exit(1);
  }
  const text = continueConversation(id, { maxTurns: Number(flags['max-turns'] || flags.limit || 250) });
  console.log(text);
  process.exit(0);
}

if (cmd === 'memory' || cmd === 'memories') {
  const { searchMemory } = await loadSearchLib();
  const query = positional.join(' ');
  const res = searchMemory({ query, limit: Number(flags.limit || 15) });
  if (flags.json) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`Matched ${res.totalMatched} memory / harvest item(s) (showing ${res.returned}):\n`);
    for (const m of res.results) {
      console.log(`[${m.kind}] ${m.title}  (project=${m.project || '-'})`);
      console.log(`  ${(m.excerpt || m.text || '').slice(0, 320).replace(/\r?\n/g, '\n  ')}\n`);
    }
  }
  process.exit(0);
}

if (cmd === 'repos') {
  const { listRepos } = await loadSearchLib();
  const filter = positional.join(' ');
  const res = listRepos({ filter, limit: Number(flags.limit || 200) });
  if (flags.json) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`Local GitHub repositories (${res.returned} of ${res.total}):\n`);
    for (const r of res.repos) {
      console.log(`${r.name.padEnd(36)} ${r.path.padEnd(46)} ${r.remote}`);
    }
  }
  process.exit(0);
}

if (cmd === 'sync') {
  const { runSync } = await loadSearchLib();
  const repos = flags['history-only'] ? false : true;
  const cloneMissing = Boolean(flags['clone-missing']);
  const history = flags['repos-only'] ? false : true;
  console.log(`Syncing (${repos ? 'GitHub repos ' : ''}${cloneMissing ? '+ cloning missing ' : ''}${history ? '+ conversation history ' : ''}+ vault)...`);
  const out = runSync({ repos, cloneMissing, history, vault: history });
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (cmd === 'hydrate' || cmd === 'resume') {
  const { getConversation } = await loadSearchLib();
  const id = positional.join(' ');
  if (!id) {
    console.error('Usage: smile hydrate <conversation-id-or-title> | smile resume <conversation-id-or-title>');
    process.exit(1);
  }
  const conv = getConversation(id, { maxTurns: Number(flags['max-turns'] || 500) });
  const tmpJson = path.join(TEMP_DIR, `hydrate-${Date.now()}.json`);
  fs.writeFileSync(tmpJson, JSON.stringify(conv), 'utf8');
  const unifyScript = path.join(SMILE_REPO_DIR, 'Smile Real Time', 'Unified CLI', 'unify.clj');
  const r = spawnSync(BB_EXE, [unifyScript, 'hydrate-json', tmpJson], {
    cwd: path.dirname(unifyScript),
    encoding: 'utf8',
    env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  try { fs.unlinkSync(tmpJson); } catch {}
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'Failed to hydrate conversation');
    process.exit(r.status ?? 1);
  }
  const jsonlPath = (r.stdout || '').trim().split(/\r?\n/).pop();
  console.log(`Hydrated v3 Pi session: ${jsonlPath}`);
  if (cmd === 'resume' && !flags['no-launch']) {
    const piCmd = firstExisting([
      path.join(HOME, 'AppData', 'Roaming', 'npm', 'pi.cmd'),
      'pi.cmd',
      'pi',
    ]) || 'pi';
    const p = spawnSync('cmd.exe', ['/c', piCmd, '--session', jsonlPath], {
      stdio: 'inherit',
      env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
    });
    process.exit(p.status ?? 0);
  }
  process.exit(0);
}

if (cmd === 'unify') {
  const unifyScript = path.join(SMILE_REPO_DIR, 'Smile Real Time', 'Unified CLI', 'unify.clj');
  const r = spawnSync(BB_EXE, [unifyScript, ...rest], {
    cwd: path.dirname(unifyScript),
    stdio: 'inherit',
    env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  process.exit(r.status ?? 0);
}

if (cmd === 'rt' || cmd === 'pi') {
  const piCmd = firstExisting([
    path.join(HOME, 'AppData', 'Roaming', 'npm', 'pi.cmd'),
    'pi.cmd',
    'pi',
  ]) || 'pi';
  const r = spawnSync('cmd.exe', ['/c', piCmd, ...rest], {
    stdio: 'inherit',
    env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  process.exit(r.status ?? 0);
}

if (cmd === 'gemini' || cmd === 'ask') {
  const promptText = positional.join(' ');
  const geminiArgs = promptText ? ['-p', promptText] : [];
  const bin = flags.agy
    ? (firstExisting(['D:\\bin\\agy.cmd', path.join(HOME, '.gemini', 'bin', 'agy.exe')]) || 'agy')
    : (firstExisting(['D:\\bin\\gemini.cmd', 'D:\\tools\\npm-global\\gemini.cmd']) || 'gemini');
  const r = spawnSync('cmd.exe', ['/c', bin, ...geminiArgs], {
    stdio: 'inherit',
    env: { ...process.env, TEMP: TEMP_DIR, TMP: TEMP_DIR },
  });
  process.exit(r.status ?? 0);
}

console.log(`Smile CLI — Smile Prompt Language, Conversation Archive & Repo Hub

Smile Language Commands:
  smile lint <file> [--json]            Check Smile conventions on a file
  smile mend <file> [--print]           Auto-mend indentation, labels & gratitude
  smile footer "<header line>" [depth]  Print matching closing Smile footer
  smile clip                            Mend clipboard text in place
  smile serve                           Start Smile HTTP checker on 127.0.0.1:4422
  smile test                            Run Smile language test suite

Conversation History & GitHub Repo Commands:
  smile stats / smile convos            Show counts of all conversations & GitHub repos
  smile search <query> [--source=...]   Search Claude Code, Harvests, ChatGPT, Antigravity & Smile chats
  smile history [query]                 Alias for 'smile search' (empty query lists newest)
  smile chat <id-or-title>              Read full conversation transcript + harvest report
  smile continue <id-or-title>          Format conversation with origin header ready to continue
  smile memory [query]                  Search CLAUDE.md, commands, memories & harvest reports
  smile repos [filter]                  List/filter all local GitHub repos
  smile library <build|ask|serve|test>  Run Smile Instance Library (trigram SQLite + 127.0.0.1:4114)
  smile sync [--clone-missing]          Pull local GitHub repos & re-ingest conversations
  smile gemini "<prompt>"               Run Gemini CLI with full Sangha history & Smile MCP tools
`);
