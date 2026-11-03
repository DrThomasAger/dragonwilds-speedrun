// Banner / end-of-run detection on three reference videos (360p, cached under the
// review home; downloaded once if missing). Skips cleanly when ffmpeg or python cv2 is
// not installed. Run: node --test tests/review   (npm run test:review)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tools, ensureDirs } from '../../scripts/review/lib.mjs';
import { download, features } from '../../scripts/review/review.mjs';
import { detectEvents } from '../../scripts/review/detect.mjs';
import { reference, analyzeRun } from '../../scripts/review/analyze.mjs';

const t = await tools();
const skip = !t.ffmpeg ? 'ffmpeg not installed' : !t.cv ? 'python with opencv (cv2) not installed' : false;
const ref = skip ? null : await reference();
if (!skip) await ensureDirs();

async function measure(id) {
  const d = await download(id);
  assert.ok(d.file, `video ${id} could not be downloaded: ${d.error}`);
  const f = await features(id, d.file);
  const events = detectEvents(f);
  return { events, run: analyzeRun({ id, events, f, ref }) };
}

const near = (got, want, tol, label) =>
  assert.ok(got != null && Math.abs(got - want) <= tol, `${label}: got ${got}, want ${want} ±${tol}`);

const CASES = [
  { id: '6WEIHo7AUf0', label: 'TexasPete 6:50', splits: [81.52, 142.62, 194.32, 290.62], tol: 0.3, end: 410.0, endTol: 0.3 },
  { id: 'doVQ9Ph256g', label: 'Nanobit 7:01', splits: [87.82, 154.92, 218.02, 305.82], tol: 0.5, end: 421.97, endTol: 0.5 },
  { id: 'WpvNjqVmpVM', label: 'SamFPlays 10:53', splits: [115.2, 212.5, 312.8, 481.4], tol: 0.5, end: 653.4, endTol: 0.5 },
];

for (const c of CASES) {
  test(`${c.label} (${c.id}): four banner splits and the cut to black`, { skip, timeout: 20 * 60 * 1000 }, async () => {
    const { events, run } = await measure(c.id);
    assert.equal(events.banners.length, 4, `expected 4 banner onsets, got ${events.banners.map(b => b.t).join(', ')}`);
    assert.equal(run.splits.length, 5);
    c.splits.forEach((s, k) => near(run.splits[k], s, c.tol, `split ${k + 1}`));
    near(run.splits[4], c.end, c.endTol, 'end (cut to black after GET OUT NOW!)');
    assert.ok(run.quality.complete);
    assert.deepEqual(run.anomalies.filter(a => a.kind === 'faster'), [], 'a reference run cannot be faster than the reference set');
  });
}

test('run start (end of the loading screen) is detected on Nanobit 7:01', { skip, timeout: 20 * 60 * 1000 }, async () => {
  const { events } = await measure('doVQ9Ph256g');
  near(events.loadEnd, 23.78, 0.3, 'loading screen end');
});
