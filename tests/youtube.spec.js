// Real YouTube embeds (network). Run with: npm run test:youtube
import { test, expect } from '@playwright/test';

test('@youtube reel cuts between two real YouTube videos', async ({ page }) => {
  const clips = [{ vid: '6WEIHo7AUf0', in: 60, out: 64, label: 'TP' }, { vid: 'doVQ9Ph256g', in: 120, out: 124, label: 'Nano' }];
  const enc = Buffer.from(JSON.stringify({ name: 'yt', clips })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await page.goto(`/#/studio?reel=${enc}`);
  await page.waitForFunction(() => window.__reel && window.__reel.decks.every(d => d.isReady), null, { timeout: 30000 });
  await page.getByRole('button', { name: '▶ Play reel' }).click();
  await page.waitForFunction(() => window.__reel.cuts.length >= 1, null, { timeout: 40000, polling: 100 });
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => { const r = window.__reel; return { i: r.i, vid: r.active.p.getVideoData().video_id, t: r.active.time(), state: r.active.state, cut: r.cuts[0] }; });
  expect(s.i).toBe(1); expect(s.vid).toBe('doVQ9Ph256g');
  expect(s.t).toBeGreaterThan(120); expect(s.t).toBeLessThan(124.1);
  expect(Math.abs(s.cut.late)).toBeLessThan(0.3);
  await page.screenshot({ path: 'docs/screens/youtube-reel.png' });
});

test('@youtube race mode keeps two real videos in sync', async ({ page }) => {
  await page.goto('/#/compare?runs=tp650,nano701');
  await page.waitForFunction(() => window.__cmp && window.__cmp.cells.every(c => c.deck.isReady), null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.__sync.seek(100); window.__sync.play(); });
  await page.waitForTimeout(8000);
  const s = await page.evaluate(() => { const g = window.__sync; return { X: g.X, shown: g.entries.map(e => g.shownT(e)), states: g.entries.map(e => e.deck.state) }; });
  expect(s.states).toEqual([1, 1]);
  for (const T of s.shown) expect(Math.abs(T - s.X)).toBeLessThan(0.5);
  await page.screenshot({ path: 'docs/screens/youtube-compare.png' });
});
