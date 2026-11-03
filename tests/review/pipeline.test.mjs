// Transcript mining, queue state and error handling of the review pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readJson, DIRS, OUT, tools } from '../../scripts/review/lib.mjs';
import { captionLines, rawLines, json3Lines, wordsToLines } from '../../scripts/review/transcript.mjs';
import { mineLines, findPhrase, topicsOf, knownMechanics, candidateFromLine } from '../../scripts/review/mine.mjs';
import { pending, priority } from '../../scripts/review/queue.mjs';
import { reviewSource } from '../../scripts/review/review.mjs';
import { bannerOnsets, endOfRun } from '../../scripts/review/detect.mjs';

// Best transcript available offline for a video: own captions > whisper cache > ingest cache.
async function transcript(id) {
  const c = await captionLines(id);
  if (c) return c.lines;
  const w = await readJson(path.join(DIRS.work, `${id}.whisper-v2.json`), null);
  if (w?.lines?.length && w.source !== 'whisper:tiny') return w.lines;
  return (await rawLines(id))?.lines || null;
}

test('keyword mining finds TexasPete\'s "where all runs go to die" near video 122 s (6WEIHo7AUf0)', async t => {
  const lines = await transcript('6WEIHo7AUf0');
  if (!lines) return t.skip('no cached transcript for 6WEIHo7AUf0 (run the pipeline once)');
  const mined = mineLines(lines);
  // whisper hears "where our runs go to die"; captions have "where all runs go to die"
  const hits = [...findPhrase(mined, 'where all runs go to die'), ...findPhrase(mined, 'where our runs go to die')];
  assert.ok(hits.length >= 1, 'phrase not among the mined technique/commentary lines');
  const h = hits[0];
  assert.ok(h.topics.includes('mistake'), `topics ${h.topics}`);
  assert.ok(Math.abs(h.tPhrase - 122) <= 3, `phrase at ${h.tPhrase} s, expected ~122 s`);
});

test('json3 word timing splits caption events into sentences', () => {
  const j = { events: [{ tStartMs: 117800, segs: [{ utf8: "All right, here's the moment of truth." }, { utf8: ' Where', tOffsetMs: 4500 }, { utf8: ' all', tOffsetMs: 4800 }, { utf8: ' runs', tOffsetMs: 5000 }, { utf8: ' go to die.', tOffsetMs: 5200 }] }] };
  const lines = json3Lines(j);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].t, 122.3);
  assert.match(lines[1].text, /Where all runs go to die/);
  assert.deepEqual(wordsToLines([]), []);
});

test('topics and candidate mechanics', async () => {
  assert.deepEqual(topicsOf('zoop off the rocks then plunge cancel').sort(), ['cancel', 'movement']);
  const known = await knownMechanics();
  assert.ok(known.names.length > 5, 'route.js / glitches.json mechanics loaded');
  assert.equal(candidateFromLine({ t: 1, text: 'Kill the air Garou Thane through the gate and windjump to the air door skip' }, known), null, 'known mechanic is not a candidate');
  const c = candidateFromLine({ t: 5, text: 'you can clip through the waterfall behind the lighthouse statue' }, known);
  assert.ok(c && c.unseen.includes('waterfall'), 'unknown clip spot is a candidate');
});

test('queue skips already-reviewed ids (and re-reviews a light review at full level)', () => {
  const q = [{ id: 'aaaaaaaaaaa' }, { id: 'bbbbbbbbbbb' }, { id: 'ccccccccccc' }, { id: 'ddddddddddd' }, { id: 'eeeeeeeeeee' }];
  const state = { ids: {
    aaaaaaaaaaa: { status: 'ok', level: 'full' },
    bbbbbbbbbbb: { status: 'ok', level: 'light' },
    ccccccccccc: { status: 'unavailable' },
    ddddddddddd: { status: 'error', attempts: 3 },
  } };
  assert.deepEqual(pending(q, state, 'full').map(x => x.id), ['bbbbbbbbbbb', 'eeeeeeeeeee']);
  assert.deepEqual(pending(q, state, 'light').map(x => x.id), ['eeeeeeeeeee']);
  assert.equal(pending(q, state, 'full', { force: true }).length, 5);
});

test('queue state on disk: every id recorded as fully reviewed is skipped', async () => {
  const state = await readJson(path.join(OUT, '_state.json'), { ids: {} });
  const done = Object.entries(state.ids).filter(([, s]) => s.status === 'ok' && s.level === 'full' && !s.transcriptRetry).map(([id]) => id);
  const q = done.map(id => ({ id }));
  assert.deepEqual(pending(q, state, 'full'), []);
});

test('unranked full runs are queued before guides and verified top-2 runs', () => {
  const unranked = priority({ kind: 'run', title: 'Kuldra raid full run no commentary' });
  const rejected = priority({ kind: 'run', run: { status: 'rejected' }, title: 'x' });
  const top = priority({ kind: 'run', run: { status: 'verified', rank: 1 }, title: 'x' });
  const guide = priority({ kind: 'guide', title: 'Kuldra guide' });
  assert.ok(rejected > top && unranked > top && unranked > guide);
});

test('malformed id is reported cleanly without crashing', async () => {
  const r = await reviewSource({ id: 'not a video!' });
  assert.equal(r.status, 'invalid');
  assert.match(r.error, /invalid YouTube id/);
  const r2 = await reviewSource({ id: undefined });
  assert.equal(r2.status, 'invalid');
});

test('unavailable video id is reported cleanly without crashing', { timeout: 5 * 60 * 1000 }, async t => {
  if (!(await tools()).ytdlp) return t.skip('yt-dlp not installed');
  const r = await reviewSource({ id: 'xxxxxxxxxx0' }); // well-formed, does not exist
  assert.ok(['unavailable', 'error'].includes(r.status), `status ${r.status}`);
  assert.ok(r.error && r.error.length > 0);
  assert.equal(r.splits, undefined);
});

test('detectors return nothing on featureless input', () => {
  const f = { fps: 10, start: 0, banner: Array(600).fill(0.3), getout: Array(600).fill(0.2), med: Array(600).fill(80), ctr: Array(600).fill(80) };
  assert.deepEqual(bannerOnsets(f), []);
  assert.equal(endOfRun(f), null);
});
