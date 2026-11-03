// End-to-end UX tests on the deterministic mock player (?player=mock).
import { test, expect } from '@playwright/test';

const M = '/?player=mock';
const VIEWS = ['today', 'hq', 'run', 'compare', 'route', 'studio', 'practice', 'timer', 'wiki', 'patches', 'library', 'hardcore'];

function watchErrors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/speedrun\.com|ERR_|Failed to load resource|raw\.githubusercontent/.test(m.text())) errs.push(m.text()); });
  return errs;
}

const SIZES = { phone: { width: 412, height: 915 }, fold: { width: 884, height: 1000 }, desktop: { width: 1440, height: 900 } };
for (const [size, vp] of Object.entries(SIZES)) {
  test(`every view at ${size} size: renders, no errors, no sideways scroll`, async ({ page }) => {
    const errs = watchErrors(page);
    await page.setViewportSize(vp);
    for (const v of VIEWS) {
      await page.goto(`${M}#/${v}`);
      await expect(page.locator('#view h1, #view .target-card').first()).toBeVisible();
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${v} scrolls sideways at ${size}`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `docs/screens/${size}/${v}.png` });
    }
    expect(errs).toEqual([]);
  });
}

test('reel cuts seamlessly across videos at the exact out-points', async ({ page }) => {
  const errs = watchErrors(page);
  const clips = [
    { vid: '6WEIHo7AUf0', in: 10, out: 11.5, label: 'A' },
    { vid: 'doVQ9Ph256g', in: 30, out: 31.5, label: 'B' },
    { vid: '6WEIHo7AUf0', in: 100, out: 101.5, label: 'C' },
    { vid: '6WEIHo7AUf0', in: 101.5, out: 103, label: 'D (contiguous)' },
  ];
  const enc = Buffer.from(JSON.stringify({ name: 't', clips })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await page.goto(`${M}#/studio?reel=${enc}`);
  await page.waitForFunction(() => window.__reel && window.__reel.active.p);
  await page.getByRole('button', { name: '▶ Play reel' }).click();
  // sample which deck is visible and what it shows, every frame, until the reel ends
  const log = await page.evaluate(() => new Promise(res => {
    const out = []; const t0 = performance.now();
    const f = () => {
      const r = window.__reel; const d = r.active;
      out.push({ t: performance.now() - t0, i: r.i, vid: d.vid, vt: d.time(), state: d.state, visible: !d.el.classList.contains('off') });
      if (performance.now() - t0 < 8000 && !(r.cuts.length && r.cuts[r.cuts.length - 1].to === -1)) requestAnimationFrame(f); else res({ out, cuts: r.cuts });
    };
    requestAnimationFrame(f);
  }));
  const cuts = log.cuts;
  expect(cuts.map(c => c.to)).toEqual([1, 2, 3, -1]);
  for (const c of cuts.filter(c => c.late != null)) expect(Math.abs(c.late)).toBeLessThan(0.08);
  // after each cross-video cut the incoming deck is already playing (primed) within ~100 ms
  for (const k of [1, 2]) {
    const first = log.out.find(s => s.i === k);
    const playing = log.out.find(s => s.i === k && s.state === 1);
    expect(playing.t - first.t).toBeLessThan(150);
    expect(Math.abs(first.vt - clips[k].in)).toBeLessThan(0.15);
  }
  // contiguous clip D did not re-seek: video time is continuous across the C→D boundary
  const cd = log.out.filter(s => s.i === 2 || s.i === 3).map(s => s.vt);
  for (let j = 1; j < cd.length; j++) expect(cd[j] - cd[j - 1]).toBeGreaterThan(-0.05);
  expect(errs).toEqual([]);
});

test('editing an out-point live retimes the running cut', async ({ page }) => {
  await page.goto(`${M}#/studio?id=p-tech`);
  await page.waitForFunction(() => window.__reel && window.__reel.clips.length === 3);
  await page.evaluate(() => { const r = window.__reel; r.clips[0].out = 3; r.playClip(0); });
  await page.waitForFunction(() => window.__reel.i === 1, null, { timeout: 6000 });
  const cut = await page.evaluate(() => window.__reel.cuts[0]);
  expect(cut.t).toBeGreaterThan(2.9); expect(cut.t).toBeLessThan(3.1);
});

test('studio handle drag scrubs the video to the handle frame', async ({ page }) => {
  await page.goto(`${M}#/studio?id=p-tp650`);
  await page.waitForSelector('.tl .handle.out');
  await page.locator('.tl').scrollIntoViewIfNeeded();
  const box = await page.locator('.tl').boundingBox();
  const h = await page.locator('.tl .handle.out').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - box.width * 0.15, h.y + h.height / 2, { steps: 5 });
  const mid = await page.evaluate(() => ({ t: window.__reel.active.time(), out: window.__reel.clips[0].out }));
  expect(Math.abs(mid.t - mid.out)).toBeLessThan(0.2); // video shows the frame under the handle
  await page.mouse.up();
  await expect(page.locator('.cliplist .clipitem').first()).toContainText('→');
  await page.screenshot({ path: 'docs/screens/studio-trim.png' });
});

test('race mode keeps every run on the same run-timer value', async ({ page }) => {
  await page.goto(`${M}#/compare?runs=tp650,nano701,tp740`);
  await page.waitForFunction(() => window.__cmp && window.__cmp.cells.every(c => c.deck.p));
  await page.evaluate(() => { window.__sync.seek(60); window.__sync.play(); });
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => { const g = window.__sync; return { X: g.X, shown: g.entries.map(e => g.shownT(e)) }; });
  for (const T of s.shown) expect(Math.abs(T - s.X)).toBeLessThan(0.3);
  expect(s.X).toBeGreaterThan(61.5);
  await page.screenshot({ path: 'docs/screens/compare-race.png' });
});

test('split-aligned mode parks the faster run on its split until the slower arrives', async ({ page }) => {
  await page.goto(`${M}#/compare?runs=tp650,nano701&mode=split`);
  await page.waitForFunction(() => window.__cmp && window.__cmp.cells.every(c => c.deck.p));
  // segment 1: TexasPete 81.52 s, Nanobit 87.82 s — put the clock 2 s before TP's split
  await page.evaluate(() => { window.__sync.seek(79.5); window.__sync.play(); });
  await page.waitForTimeout(3500);
  const s = await page.evaluate(() => { const g = window.__sync; return g.entries.map(e => ({ T: g.shownT(e), hold: g.target(e).hold, state: e.deck.state })); });
  expect(s[0].hold).toBe(true);
  expect(Math.abs(s[0].T - 81.52)).toBeLessThan(0.15);
  expect(s[1].hold).toBe(false);
  expect(s[1].T).toBeGreaterThan(82);
  await page.screenshot({ path: 'docs/screens/compare-split.png' });
});

test('adjusting a split mark re-syncs and persists', async ({ page }) => {
  await page.goto(`${M}#/compare?runs=tp650,nano701`);
  await page.waitForFunction(() => window.__cmp && window.__cmp.cells.every(c => c.deck.p));
  const row = page.locator('.nudge').filter({ hasText: /^1/ }).first();
  await row.getByRole('button', { name: '+1', exact: true }).click();
  await expect(page.getByText('edited')).toBeVisible();
  await page.waitForTimeout(200);
  const v = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_lab_v2')).runs.tp650.splits[0]);
  expect(v).toBeCloseTo(82.5, 1);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('as measured')).toBeVisible();
});

test('split timer: run, PB, golds, LiveSplit export → import round-trip', async ({ page }) => {
  await page.goto(`${M}#/timer`);
  await page.locator('#view').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  await expect(page.locator('.timer-big')).toHaveClass(/pb|done/);
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_lab_v2')).timer);
  expect(t.pb.splits).toHaveLength(5); expect(t.best.every(x => x > 0)).toBe(true);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '⬇ Export .lss' }).click()]);
  const path = await dl.path();
  const xml = (await import('node:fs')).readFileSync(path, 'utf8');
  expect(xml).toContain('<SplitTime name="TexasPete 6:50 (WR)">');
  const back = await page.evaluate(async x => (await import('/js/lib/lss.js')).importLss(x), xml);
  expect(back.names).toEqual(['Dragontail Vines', 'Fragments of Ghornfell', 'The Shattered Stronghold', 'Cataclysm Keep', "Kuldra's Sanctum"]);
  for (let k = 0; k < 5; k++) expect(back.pb.splits[k]).toBeCloseTo(t.pb.splits[k], 3);
  expect(back.attempts).toHaveLength(1);
  await page.screenshot({ path: 'docs/screens/timer-done.png' });
});

test('practice logs attempts and suggests the weakest drill', async ({ page }) => {
  await page.goto(`${M}#/practice?skip=s-thane`);
  await page.locator('#view').click({ position: { x: 5, y: 5 } });
  for (const k of ['k', 'k', 'j']) await page.keyboard.press(k);
  await expect(page.getByText('33% of last 3').first()).toBeVisible();
  await page.goto(`${M}#/practice`);
  await expect(page.locator('.drill.cur')).toContainText('Garou Thane');
});

test('route and library chips play the right clip', async ({ page }) => {
  await page.goto(`${M}#/route?split=4`);
  await page.locator('#split-4 .chip').filter({ hasText: 'Dotxy' }).click();
  await page.waitForFunction(() => window.__reel && window.__reel.active.vid === 'GeWbo4GpFEg');
  await page.goto(`${M}#/library`);
  await page.getByRole('button', { name: 'Play Speedrun WR (6:50) Kuldra RAID w/ Commentary' }).click();
  await page.waitForFunction(() => window.__reel && window.__reel.clips.length === 5 && Math.abs(window.__reel.active.time() - 7.38) < 0.5);
});

test('hardcore checklist progress persists (and migrates v1 data)', async ({ page }) => {
  await page.goto(`${M}#/hq`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dw_hc_route_v1', JSON.stringify({ done: { 'p0.0.0': true }, phase: 'p0' })); });
  await page.goto(`${M}#/hardcore`);
  await page.reload();
  await expect(page.locator('#hctext')).toContainText('1 of');
  await page.keyboard.press('d');
  await expect(page.locator('#hctext')).toContainText('2 of');
});

test('in-game Run mode uses shared data and shares progress with the lab', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto(`${M}#/hardcore`);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/hardcore-run.html');
  await expect(page.locator('#body')).not.toBeEmpty();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screens/hardcore-run.png' });
  const html = await page.content();
  expect(html).not.toContain('Tgp1BYFv5nw');
  await page.locator('#bottom button, #bottom').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press('n');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/screens/hardcore-run-step.png' });
  const done = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_hc_v3') || '{}').done || {});
  expect(Object.values(done).filter(Boolean).length).toBe(1);
  await page.goto(`${M}#/hardcore`);
  await expect(page.locator('#hctext')).toContainText('1 of');
  await page.getByRole('link', { name: /In-game Run mode/ }).click();
  await expect(page).toHaveURL(/hardcore-run\.html/);
  expect(errs.filter(e => !/youtube|postMessage/i.test(e))).toEqual([]);
});

test('run navigator: pre-flight → split through every split → summary saved to timer', async ({ page }) => {
  await page.setViewportSize(SIZES.phone);
  await page.goto(`${M}#/run`);
  await page.getByRole('button', { name: /Start run/ }).click();
  await expect(page.locator('.rn-split')).toContainText('Dragontail Vines');
  await expect(page.locator('.rn-skip h2')).toHaveText(/.+/);
  await page.keyboard.press('n');
  await expect(page.locator('.rn-skip .note').first()).toContainText('Skip 2');
  await page.screenshot({ path: 'docs/screens/phone/run-live.png' });
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(120); await page.locator('.rn-big').click(); }
  await expect(page.locator('#view h1')).toHaveText(/New PB|Run complete/);
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_lab_v2')).timer);
  expect(t.pb.splits).toHaveLength(5);
  await page.screenshot({ path: 'docs/screens/phone/run-done.png' });
});

test('patch notes load, flag raid lines, and the route banner reflects the latest version', async ({ page }) => {
  await page.goto(`${M}#/patches`);
  await expect(page.locator('.patch').first()).toBeVisible();
  await expect(page.getByText('Fixed several Windstep-related skips').first()).toBeVisible();
  await expect(page.locator('.callout').first()).toContainText('1.0.1.2');
});

test('installable: manifest, icons and service worker', async ({ page, request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  for (const i of m.icons) expect((await request.get('/' + i.src)).ok()).toBe(true);
  await page.goto(`${M}#/hq`);
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  expect(sw).toBe(true);
});

test('phone: bottom tab bar + More sheet reach every section', async ({ page }) => {
  await page.setViewportSize(SIZES.phone);
  await page.goto(`${M}#/hq`);
  await expect(page.locator('#nav a[data-r="run"]')).toBeVisible();
  await expect(page.locator('#nav a[data-r="wiki"]')).toBeHidden();
  await page.locator('#moreBtn').click();
  await page.locator('#moreGrid a[data-r="wiki"]').click();
  await expect(page).toHaveURL(/#\/wiki/);
  await expect(page.locator('#more')).not.toHaveAttribute('open', '');
});

test('command palette jumps to a skip drill', async ({ page }) => {
  await page.goto(`${M}#/hq`);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('garou thane');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/practice\?skip=s-thane/);
  await expect(page.locator('.drill.cur')).toContainText('Garou Thane');
});

test('segment practice times one split and keeps history', async ({ page }) => {
  await page.setViewportSize({ width: 884, height: 1000 });
  await page.goto(`${M}#/run`);
  await page.getByRole('button', { name: /3\. The Shattered Stronghold/ }).click();
  await expect(page.locator('.rn-split')).toContainText('Segment practice');
  for (const _ of [0, 1]) { await page.locator('.rn-big').click(); await page.waitForTimeout(200); await page.locator('.rn-big').click(); await page.waitForTimeout(100); await page.locator('.rn-big').click(); }
  await page.waitForTimeout(200);
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_lab_v2')).segPractice[2]);
  expect(log.length).toBe(2);
  await page.screenshot({ path: 'docs/screens/fold/run-segment.png' });
});
