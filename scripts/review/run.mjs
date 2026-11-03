// Raid review pipeline — process the queue.
//
//   node scripts/review/run.mjs                 full review of every pending source
//   node scripts/review/run.mjs --light         CI level: queue + transcripts + keyword mining (no video)
//   node scripts/review/run.mjs --only=ID,ID    just these ids (still recorded in the state file)
//   node scripts/review/run.mjs --max=10 --jobs=3 --force --no-search --min-priority=40
//   node scripts/review/run.mjs --budget=12     stop starting new reviews after 12 min (rest wait for the next run)
//   node scripts/review/run.mjs --list          print the queue with priorities and exit
//   node scripts/review/run.mjs --watch         loop: rebuild the queue and review new sources every hour
//                                               (--every=MINUTES to change the interval)
// Outputs data/kb/reviews/<id>.json, index.json, _state.json, _search.json and
// docs/review/<id>.md, index.md. See docs/review/README.md.
import path from 'node:path';
import { OUT, ensureDirs, arg, sleep, now, tools, readJson, writeJson, backoffUntil } from './lib.mjs';
import { buildQueue, loadState, saveState, pending, LEVELS } from './queue.mjs';
import { reviewSource, writeReview, writeIndex } from './review.mjs';
import { knownMechanics } from './mine.mjs';
import { reference } from './analyze.mjs';

// New _state.json entry for one reviewed id. A "deferred" result (YouTube's "Sign in to
// confirm you're not a bot") is not a failure: the previous status/level and attempt count are
// kept, and retryAfter backs the id off (45 min, 1.5 h, 3 h … 24 h) so a later run retries it.
export function nextState(prev, r, it = {}, at = Date.now()) {
  const title = r.title || it.title || prev.title || null;
  if (r.status === 'deferred') {
    const botBlocks = (prev.botBlocks || 0) + 1;
    const keep = prev.status && !['error', 'deferred'].includes(prev.status);
    const { retryAfter: _r, botBlocks: _b, ...rest } = prev;
    return {
      write: !keep,
      entry: { ...rest, status: keep ? prev.status : 'deferred', ...(keep ? {} : { level: prev.level || r.level }), attempts: prev.attempts || 0,
        botBlocks, retryAfter: backoffUntil(botBlocks, at), deferredAt: new Date(at).toISOString(), lastError: String(r.error || 'bot check').slice(0, 200), title },
    };
  }
  // keep a previous full review when this run could not do better
  const worse = prev.status === 'ok' && (r.status !== 'ok' || (LEVELS[r.level] || 0) < (LEVELS[prev.level] || 0));
  return {
    write: !worse,
    entry: {
      status: worse ? prev.status : r.status,
      level: worse ? prev.level : r.level,
      reviewedAt: r.reviewedAt, attempts: r.status === 'error' && !r.rateLimited ? (prev.attempts || 0) + 1 : 0,
      ...(r.error ? { lastError: String(r.error).slice(0, 200) } : {}),
      ...(r.transcriptRetry ? { transcriptRetry: true, transcriptAttempts: (prev.transcriptAttempts || 0) + 1 } : {}), title,
    },
  };
}

export async function processQueue({ level = 'full', only = null, max = Infinity, minPriority = -Infinity, jobs = 3, force = false, search = true, budgetMin = Infinity, log = console.error } = {}) {
  const deadline = Date.now() + budgetMin * 60 * 1000;
  await ensureDirs();
  const t = await tools();
  log(`tools: ${JSON.stringify(t)}`);
  const state = await loadState();
  let todo;
  if (only) {
    const ids = String(only).split(',').map(s => s.trim()).filter(Boolean);
    const q = await buildQueue({ search: false });
    todo = ids.map(id => q.find(x => x.id === id) || { id, from: ['cli'], priority: 0 });
    if (!force) todo = pending(todo, state, level);
  } else {
    const q = await buildQueue({ search });
    todo = pending(q, state, level, { force });
    log(`queue: ${q.length} sources, ${todo.length} pending at level ${level}`);
  }
  todo = todo.filter(it => only || (it.priority ?? 0) >= minPriority).slice(0, max);
  const known = await knownMechanics();
  const ref = await reference();
  const results = [];
  let next = 0, rateLimited = 0;
  async function worker() {
    while (next < todo.length) {
      const it = todo[next++];
      if (rateLimited >= 3) { results.push({ id: it.id, status: 'deferred' }); continue; }
      if (Date.now() > deadline) { results.push({ id: it.id, status: 'deferred', reason: 'time budget' }); continue; }
      const t0 = Date.now();
      log(`review ${it.id} [p${it.priority}] ${it.title || ''}`);
      let r;
      try { r = await reviewSource(it, { level, known, ref, log }); }
      catch (e) { r = { id: it.id, status: 'error', error: String(e.stack || e).slice(0, 500), reviewedAt: now(), level }; }
      if (r.rateLimited) rateLimited++;
      const prev = state.ids[it.id] || {};
      const { entry, write } = nextState(prev, r, it);
      if (write) await writeReview(r);
      state.ids[it.id] = entry;
      await saveState(state);
      results.push({ id: it.id, status: r.status, secs: Math.round((Date.now() - t0) / 1000), splits: r.splits?.length ?? 0, candidates: r.candidateMechanics?.length ?? 0, error: r.error });
      log(`  → ${r.status}${r.error ? ' ' + r.error : ''} (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  const later = results.filter(r => r.reason === 'time budget').length;
  if (later) log(`time budget of ${budgetMin} min reached: ${later} left for the next run`);
  const idx = await writeIndex();
  return { results, index: { count: idx.count, ok: idx.ok, complete: idx.complete } };
}

// One pipeline at a time (a --watch loop, a scheduled job and a manual run would race on
// _state.json): data/kb/reviews/_lock.json holds the pid of the running process.
const LOCK = path.join(OUT, '_lock.json');
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
async function lock() {
  const l = await readJson(LOCK, null);
  if (l?.pid && l.pid !== process.pid && alive(l.pid)) return l;
  await writeJson(LOCK, { pid: process.pid, at: now(), argv: process.argv.slice(2) });
  return null;
}
async function unlock() {
  const l = await readJson(LOCK, null);
  if (l?.pid === process.pid) await writeJson(LOCK, { pid: null, releasedAt: now() });
}

async function main() {
  const level = arg('light', false) ? 'light' : String(arg('level', 'full'));
  const opts = { level, only: arg('only', null), max: +arg('max', Infinity), minPriority: +arg('min-priority', -Infinity), jobs: +arg('jobs', 3), force: !!arg('force', false), search: !arg('no-search', false), budgetMin: +arg('budget', Infinity) };
  if (arg('list', false)) {
    const q = await buildQueue({ search: opts.search });
    const st = await loadState();
    for (const it of q) console.log(`${String(it.priority).padStart(3)} ${it.id} ${(st.ids[it.id]?.status || '-').padEnd(11)} ${it.kind.padEnd(5)} ${it.run ? `${it.run.status} #${it.run.rank ?? '-'} ` : ''}${(it.title || '').slice(0, 70)} [${it.from.join(',')}]`);
    console.log(`${q.length} sources, ${pending(q, st, level).length} pending at level ${level}`);
    return;
  }
  const held = await lock();
  if (held) { console.error(`review pipeline already running (pid ${held.pid} since ${held.at}); exiting`); return; }
  process.on('SIGINT', async () => { await unlock(); process.exit(130); });
  if (arg('watch', false)) {
    const every = +arg('every', 60) * 60 * 1000;
    console.error(`watching: reviewing new raid sources every ${every / 60000} min (Ctrl+C to stop)`);
    for (;;) {
      try { const r = await processQueue(opts); console.log(JSON.stringify({ at: now(), reviewed: r.results.length, index: r.index })); }
      catch (e) { console.error('watch cycle failed:', e.message); }
      await sleep(every);
    }
  }
  try { const r = await processQueue(opts); console.log(JSON.stringify(r, null, 1)); }
  finally { await unlock(); }
}

import { isMain } from './lib.mjs';
if (isMain(import.meta)) await main();
