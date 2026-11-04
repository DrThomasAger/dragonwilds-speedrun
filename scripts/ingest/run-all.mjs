// Runs every knowledge-base ingester in turn and prints a summary.
//   node scripts/ingest/run-all.mjs [--only=speedrun,youtube,...] [--skip=twitch] [--whisper]
// Order: speedrun (feeds runner/VOD lists) → youtube → twitch → reddit → discord.
// Every new item each ingester finds is appended to data/kb/raw/ingest-log.jsonl as
// {at, source, kind, id, title}; a run summary line (kind "run-summary") is appended too.
// Exit code is 0 unless every selected source failed outright.
import path from 'node:path';
import { RAW, writeJson, logNew, now, arg } from './lib.mjs';
import { ingestSpeedrun } from './speedrun.mjs';
import { ingestYoutube } from './youtube.mjs';
import { ingestTwitch } from './twitch.mjs';
import { ingestReddit } from './reddit.mjs';
import { ingestDiscord } from './discord.mjs';

const ALL = { speedrun: ingestSpeedrun, youtube: ingestYoutube, twitch: ingestTwitch, reddit: ingestReddit, discord: ingestDiscord };
const only = arg('only', null), skip = arg('skip', null);
const names = (only ? String(only).split(',') : Object.keys(ALL)).filter(n => !(skip && String(skip).split(',').includes(n)));

const started = now(), results = {};
let newItems = 0;
const log = async (...a) => { newItems++; await logNew(...a); };
for (const n of names) {
  if (!ALL[n]) { console.error('unknown source', n); continue; }
  const t0 = Date.now();
  console.error(`== ${n}`);
  // only: null so youtube.mjs doesn't read run-all's own --only=<sources> as video ids.
  try { results[n] = await ALL[n]({ log, only: null }); }
  catch (e) { results[n] = { source: n, failed: e.message }; }
  results[n].seconds = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify(results[n]));
}
await logNew('run-all', 'run-summary', started, `${names.join(',')}: ${newItems} new items`);
await writeJson(path.join(RAW, 'last-run.json'), { started, finished: now(), newItems, results });
console.log(`run-all: ${newItems} new items logged to data/kb/raw/ingest-log.jsonl`);
if (names.length && names.every(n => results[n]?.failed)) process.exit(1);
