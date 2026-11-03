// YouTube "Sign in to confirm you're not a bot": review and ingest back off and retry later
// instead of marking the video failed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBotBlock, backoffUntil, backedOff, noteBotBlock, clearBotBlock, BOT_BACKOFF_MS, BOT_BACKOFF_MAX_MS } from '../../scripts/ingest/lib.mjs';
import { pending } from '../../scripts/review/queue.mjs';
import { nextState } from '../../scripts/review/run.mjs';

// the exact stderr yt-dlp printed for 7drO4EDaJTo on 2026-11-03
const BOT = 'ERROR: [youtube] 7drO4EDaJTo: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication. See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-';
const T0 = Date.parse('2026-11-03T20:00:00Z');

test('bot check is recognised (curly and straight apostrophe), other errors are not', () => {
  assert.ok(isBotBlock(BOT));
  assert.ok(isBotBlock("ERROR: [youtube] x: Sign in to confirm you're not a bot"));
  assert.ok(!isBotBlock('ERROR: [youtube] x: Video unavailable'));
  assert.ok(!isBotBlock('HTTP Error 429: Too Many Requests'));
  assert.ok(!isBotBlock(undefined));
});

test('back-off grows 45 min, 1.5 h, 3 h ... and stops at 24 h', () => {
  assert.equal(Date.parse(backoffUntil(1, T0)) - T0, BOT_BACKOFF_MS);
  assert.ok(BOT_BACKOFF_MS < 60 * 60 * 1000, 'first retry fits the next hourly run');
  assert.equal(Date.parse(backoffUntil(2, T0)) - T0, 2 * BOT_BACKOFF_MS);
  assert.equal(Date.parse(backoffUntil(3, T0)) - T0, 4 * BOT_BACKOFF_MS);
  assert.equal(Date.parse(backoffUntil(30, T0)) - T0, BOT_BACKOFF_MAX_MS);
});

test('review: a bot-blocked video is deferred, not failed, and retried after the back-off', () => {
  const r = { id: '7drO4EDaJTo', status: 'deferred', rateLimited: true, botBlock: true, error: BOT, level: 'full' };
  // first time seen
  let { entry, write } = nextState({}, r, { title: 'Kuldra guide' }, T0);
  assert.equal(entry.status, 'deferred');
  assert.notEqual(entry.status, 'error');
  assert.equal(entry.attempts, 0, 'not counted as a failed attempt');
  assert.equal(entry.botBlocks, 1);
  assert.equal(entry.retryAfter, backoffUntil(1, T0));
  assert.ok(write);
  // three bot blocks in a row never use up the 3 error attempts
  let s = entry;
  for (let i = 0; i < 3; i++) s = nextState(s, r, {}, T0).entry;
  assert.equal(s.attempts, 0);
  assert.equal(s.botBlocks, 4);
  // queue: skipped while backed off, queued again once retryAfter has passed
  const q = () => [{ id: '7drO4EDaJTo' }];
  const state = { ids: { '7drO4EDaJTo': entry } };
  assert.deepEqual(pending(q(), state, 'full', { at: T0 + 60 * 1000 }), []);
  assert.deepEqual(pending(q(), state, 'full', { at: T0 + BOT_BACKOFF_MS + 1000 }).map(x => x.id), ['7drO4EDaJTo']);
  // a later success clears the back-off
  const ok = nextState(entry, { id: '7drO4EDaJTo', status: 'ok', level: 'full', reviewedAt: 'x' }, {}, T0).entry;
  assert.equal(ok.status, 'ok');
  assert.equal(ok.retryAfter, undefined);
  assert.equal(ok.botBlocks, undefined);
});

test('review: a bot block never overwrites an earlier good review', () => {
  const prev = { status: 'ok', level: 'light', reviewedAt: '2026-11-01T00:00:00Z', attempts: 0 };
  const { entry, write } = nextState(prev, { status: 'deferred', error: BOT, level: 'full' }, {}, T0);
  assert.equal(write, false);
  assert.equal(entry.status, 'ok');
  assert.equal(entry.level, 'light');
  assert.ok(entry.retryAfter);
});

test('review: old state entries marked "error" by a bot check are retried, not given up on', () => {
  const state = { ids: { aaaaaaaaaaa: { status: 'error', attempts: 3, lastError: BOT }, bbbbbbbbbbb: { status: 'error', attempts: 3, lastError: 'scan failed' } } };
  assert.deepEqual(pending([{ id: 'aaaaaaaaaaa' }, { id: 'bbbbbbbbbbb' }], state, 'full').map(x => x.id), ['aaaaaaaaaaa']);
});

test('ingest: noteBotBlock backs a video off and clearBotBlock resets it', () => {
  const st = { transcript: 'retry' };
  noteBotBlock(st, BOT, T0);
  assert.equal(st.botBlocks, 1);
  assert.ok(backedOff(st, T0 + 1000));
  assert.ok(!backedOff(st, T0 + BOT_BACKOFF_MS + 1));
  assert.equal(st.transcript, 'retry', 'transcript state untouched: still to do');
  noteBotBlock(st, BOT, T0);
  assert.equal(st.retryAfter, backoffUntil(2, T0));
  clearBotBlock(st);
  assert.deepEqual(st, { transcript: 'retry' });
});
