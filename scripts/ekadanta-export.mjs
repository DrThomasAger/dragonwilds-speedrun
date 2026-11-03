#!/usr/bin/env node
// Ekadanta feed: writes this repo's new and changed texts (blog posts, knowledge-base
// pages, daily notes) into the Ekadanta inbox, one JSON document per line:
//   {source, title, text, url, ts}   (+ id, project, tags, private)
// Inbox:  D:\labyrinth\ekadanta-inbox\dragonwilds\<YYYY-MM-DD>.jsonl   (EKADANTA_INBOX overrides the root)
// State:  .exported.json in the same folder (id -> hash), so each run writes only what is new
//         or changed. Nothing is ever deleted; a changed text is written again as a new version.
// Usage:  node scripts/ekadanta-export.mjs [--all] [--dry-run]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'dragonwilds';
const SITE = 'https://drthomasager.github.io/dragonwilds-speedrun/';
const INBOX = join(process.env.EKADANTA_INBOX || 'D:\\labyrinth\\ekadanta-inbox', PROJECT);
const ALL = process.argv.includes('--all'), DRY = process.argv.includes('--dry-run');
const TAGS = ['dragonwilds', 'raid-lab', 'speedrun'];

const docs = [];
const add = d => { if (d.text && d.text.trim()) docs.push({ project: PROJECT, private: false, tags: TAGS, ...d, text: d.text.trim() }); };

// ---- blog posts: content/blog/posts/*.md (front matter + markdown body)
const postsDir = join(ROOT, 'content', 'blog', 'posts');
if (existsSync(postsDir)) for (const f of readdirSync(postsDir).filter(f => f.endsWith('.md')).sort()) {
  const raw = readFileSync(join(postsDir, f), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const fm = m ? m[1] : '', body = m ? m[2] : raw;
  const field = k => (fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1]?.replace(/^['"]|['"]$/g, '').trim() || '';
  add({ id: `blog:${field('slug') || f}`, source: 'dragonwilds-speedrun/blog', title: field('title') || f, text: body, url: field('canonical') || `${SITE}content/blog/posts/${f}`, tags: [...TAGS, 'blog'] });
}

// ---- knowledge-base pages: data/kb/pages.json
const blockText = b => {
  if (b.type === 'heading') return `## ${b.text}`;
  if (b.type === 'paragraph' || b.type === 'code') return b.text;
  if (b.type === 'quote') return `"${b.text}"${b.author ? ` (${b.author})` : ''}`;
  if (b.type === 'list') return (b.items || []).map(i => `- ${typeof i === 'string' ? i : i.text || JSON.stringify(i)}`).join('\n');
  if (b.type === 'table') return [b.title, (b.columns || []).join(' | '), ...(b.rows || []).map(r => r.join(' | '))].filter(Boolean).join('\n');
  if (b.type === 'chart') return `${b.title || 'Chart'}: ${(b.series || []).map(s => `${s.name} ${(s.values || []).join(', ')}`).join('; ')}`;
  return b.text || '';
};
const kbFile = join(ROOT, 'data', 'kb', 'pages.json');
if (existsSync(kbFile)) {
  const kb = JSON.parse(readFileSync(kbFile, 'utf8'));
  for (const p of kb.pages || []) add({
    id: `kb:${p.id}`, source: 'dragonwilds-speedrun/kb', title: p.title,
    text: [p.summary, ...(p.body || []).map(blockText)].filter(Boolean).join('\n\n'),
    url: `${SITE}#/kb?p=${encodeURIComponent(p.id)}`, tags: [...TAGS, 'kb', p.type].filter(Boolean), updated: p.updated,
  });
}

// ---- daily notes (the daily review): data/kb/daily.json
const dailyFile = join(ROOT, 'data', 'kb', 'daily.json');
if (existsSync(dailyFile)) for (const d of JSON.parse(readFileSync(dailyFile, 'utf8')).days || []) add({
  id: `daily:${d.date}`, source: 'dragonwilds-speedrun/daily', title: `Raid Lab daily notes ${d.date}`,
  text: (d.items || []).map(i => `- ${i.kind}: ${i.text}${i.url ? ` (${i.url})` : ''}`).join('\n'),
  url: `${SITE}#/kb?mode=daily`, tags: [...TAGS, 'daily'],
});

// ---- write the new and the changed
const stateFile = join(INBOX, '.exported.json');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const hash = d => createHash('sha256').update(d.title + '\n' + d.text).digest('hex').slice(0, 16);
const fresh = docs.filter(d => ALL || state[d.id] !== hash(d));
const ts = new Date().toISOString();
const out = join(INBOX, `${ts.slice(0, 10)}.jsonl`);
if (!DRY && fresh.length) {
  mkdirSync(INBOX, { recursive: true });
  appendFileSync(out, fresh.map(d => JSON.stringify({ source: d.source, title: d.title, text: d.text, url: d.url, ts, id: d.id, project: d.project, tags: d.tags, private: d.private, ...(d.updated ? { updated: d.updated } : {}) })).join('\n') + '\n');
  for (const d of fresh) state[d.id] = hash(d);
  writeFileSync(stateFile, JSON.stringify(state, null, 1));
}
console.log(`${docs.length} texts, ${fresh.length} new or changed${DRY ? ' (dry run, nothing written)' : fresh.length ? ` -> ${out}` : ''}`);
