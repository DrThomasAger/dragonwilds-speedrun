// "RaidLab Transcripts" (every 2 h): YouTube transcript ingest only, no comments.
// Log: D:\claude-temp\logs\transcripts-<date>.log
import { logger, step, ROOT } from './lib.mjs';

const L = logger('transcripts');
L.say('start');
const { ok } = step(L, 'youtube transcripts', 'node', ['scripts/ingest/youtube.mjs', '--no-comments'], { cwd: ROOT, timeout: 110 * 60 * 1000 });
L.say('done');
process.exit(ok ? 0 : 1);
