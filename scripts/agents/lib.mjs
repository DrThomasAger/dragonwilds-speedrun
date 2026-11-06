// Shared helpers for the Agent Observatory (scripts/agents/*).
// Writes to D: whenever D: exists (never C: on multi-drive PCs), with clean fallback on single-drive PCs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HAS_D = exists('D:\\');
export const TEMP_ROOT = process.env.SMILE_TEMP || (HAS_D ? 'D:\\claude-temp' : path.join(ROOT, '.tmp'));
export const OUT = path.join(ROOT, 'data', 'kb', 'agents');
export const CONV_DIR = path.join(OUT, 'conversations');
export const SCRATCH = path.join(TEMP_ROOT, 'agents');
export const HOME = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Hanjo';
export const TEXT_MAX = 4000;

export function ensureDirs() {
  for (const d of [OUT, CONV_DIR, SCRATCH]) fs.mkdirSync(d, { recursive: true });
}

// On machines with D:, refuse to write anywhere outside D:. On single-drive machines, restrict to ROOT or TEMP_ROOT.
function guard(p) {
  const abs = path.resolve(p);
  if (HAS_D) {
    if (!/^d:/i.test(abs)) throw new Error(`refusing to write outside D: -> ${abs}`);
    return abs;
  }
  const allowed = [path.resolve(ROOT).toLowerCase(), path.resolve(TEMP_ROOT).toLowerCase()];
  if (!allowed.some(base => abs.toLowerCase().startsWith(base))) {
    throw new Error(`refusing to write outside workspace/temp -> ${abs}`);
  }
  return abs;
}

export function writeJSON(p, obj, pretty = false) {
  fs.writeFileSync(guard(p), pretty ? JSON.stringify(obj, null, 1) : JSON.stringify(obj));
}
export function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

export function trunc(s, n = TEXT_MAX) {
  if (s == null) return '';
  s = String(s);
  return s.length > n ? s.slice(0, n) + `…[+${s.length - n} chars]` : s;
}
export function safeId(s) { return String(s).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120); }
export function iso(t) {
  if (t == null || t === '') return null;
  if (typeof t === 'number') return new Date(t < 1e12 ? t * 1000 : t).toISOString();
  const d = new Date(t); return isNaN(d) ? null : d.toISOString();
}

// Normalised conversation shape:
// {source, model, id, title, started, ended, project, turns:[{role,t,text}], ...extra}
export function saveConversation(conv) {
  const turns = conv.turns.filter(t => t.text && String(t.text).trim());
  turns.sort((a, b) => (a.t && b.t ? (a.t < b.t ? -1 : a.t > b.t ? 1 : 0) : 0));
  const c = {
    source: conv.source, model: conv.model || null, id: String(conv.id),
    title: conv.title || null,
    started: conv.started || turns.find(t => t.t)?.t || null,
    ended: conv.ended || [...turns].reverse().find(t => t.t)?.t || null,
    project: conv.project || null,
    ...conv.extra,
    turns: turns.map(t => ({ role: t.role, t: t.t || null, text: trunc(t.text), ...(t.name ? { name: t.name } : {}) })),
  };
  const file = `${safeId(c.source)}-${safeId(c.id)}.json`;
  writeJSON(path.join(CONV_DIR, file), c);
  const roles = {};
  for (const t of c.turns) roles[t.role] = (roles[t.role] || 0) + 1;
  return {
    file, source: c.source, model: c.model, id: c.id, title: c.title, started: c.started, ended: c.ended,
    project: c.project, turns: c.turns.length, roles, ...(conv.extra?.parent ? { parent: conv.extra.parent } : {}),
    ...(conv.extra?.automated ? { automated: true } : {}),
  };
}
