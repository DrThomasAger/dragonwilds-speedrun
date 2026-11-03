// Voice (js/lib/speak.js): read-aloud on every view, run call-outs, Claude replies,
// Breeze TTS 2 with browser fallback, Ctrl+Shift+Esc. speechSynthesis is mocked so the
// tests hear exactly what would be said, without sound.
import { test, expect } from '@playwright/test';

const M = '/?player=mock';
const VIEWS = ['today', 'hq', 'run', 'compare', 'route', 'studio', 'practice', 'timer', 'wiki', 'kb', 'patches', 'library', 'hardcore'];

async function mockSpeech(page, prefs = { url: '' }) {
  await page.addInitScript(p => {
    window.__spoken = []; window.__cancels = 0;
    class U { constructor(t) { this.text = t; this.rate = 1; } }
    const fake = {
      speaking: false, _cur: null,
      speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, voice: u.voice && u.voice.name }); this._cur = u; this.speaking = true; u._t = setTimeout(() => { this.speaking = false; this._cur = null; u.onend && u.onend(); }, 150); },
      cancel() { window.__cancels++; const u = this._cur; if (u) { clearTimeout(u._t); this._cur = null; this.speaking = false; u.onend && u.onend(); } },
      getVoices() { return [{ name: 'Test Voice', lang: 'en-GB' }]; },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = U;
    if (!localStorage.getItem('speak_prefs_v1')) localStorage.setItem('speak_prefs_v1', JSON.stringify(p));
  }, prefs);
}
const spoken = page => page.evaluate(() => window.__spoken.map(s => s.text));
function watchErrors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/speedrun\.com|ERR_|Failed to load resource|raw\.githubusercontent/.test(m.text())) errs.push(m.text()); });
  return errs;
}

test('🔊 on every view reads that view\'s main content, and the button stops it', async ({ page }) => {
  test.setTimeout(150000); // thirteen views in one test
  const errs = watchErrors(page);
  await mockSpeech(page);
  for (const v of VIEWS) {
    await page.goto(`${M}#/${v}`);
    const head = page.locator('#view h1, #view .target-card').first();
    await expect(head).toBeVisible();
    await page.waitForTimeout(300);
    const before = (await spoken(page)).length;
    const btn = page.locator('#speakSlot .speak-btn');
    await btn.click();
    await expect.poll(async () => (await spoken(page)).length, { message: `${v} spoke` }).toBeGreaterThan(before);
    const said = (await spoken(page)).slice(before).join(' ');
    const words = (await head.innerText()).replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
    expect(said.toLowerCase(), `${v} reads its own page`).toContain(words.toLowerCase());
    expect(said).not.toMatch(/Search everything|Keyboard shortcuts/); // no header chrome
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await btn.click(); // ⏹
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  }
  expect(errs).toEqual([]);
});

test('Ctrl+Shift+Esc stops speech at once and empties the queue', async ({ page }) => {
  await mockSpeech(page);
  await page.goto(`${M}#/kb`);
  await expect(page.locator('#view h1').first()).toBeVisible();
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.speak('One. '.repeat(10) + 'Two sentences here. '.repeat(40))));
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  await page.keyboard.press('Control+Shift+Escape');
  const st = await page.evaluate(() => window.__speak.status());
  expect(st.speaking).toBe(false);
  expect(st.queued).toBe(0);
  const n = (await spoken(page)).length;
  await page.waitForTimeout(700);
  expect((await spoken(page)).length).toBe(n);
  expect(await page.evaluate(() => window.__cancels)).toBeGreaterThan(0);
});

test('run navigator speaks splits with pace deltas, and the toggle silences it', async ({ page }) => {
  await mockSpeech(page);
  await page.goto(`${M}#/run`);
  const toggle = page.locator('[data-speak-toggle="calls"]').first();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await spoken(page)).join(' ')).toMatch(/^Go\./);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__run.split());
  await expect.poll(async () => (await spoken(page)).join(' ')).toMatch(/(behind|ahead|dead even) versus /);
  const all = (await spoken(page)).join(' ');
  expect(all).toMatch(/Next: /);
  // toggle off from the run screen: next split is silent
  await page.locator('[data-speak-toggle="calls"]').first().click();
  await expect(page.locator('[data-speak-toggle="calls"]').first()).toHaveAttribute('aria-pressed', 'false');
  const n = (await spoken(page)).length;
  await page.evaluate(() => window.__run.split());
  await page.waitForTimeout(500);
  expect((await spoken(page)).length).toBe(n);
  // S turns it back on
  await page.keyboard.press('s');
  await expect(page.locator('[data-speak-toggle="calls"]').first()).toHaveAttribute('aria-pressed', 'true');
});

test('split timer page speaks splits too', async ({ page }) => {
  await mockSpeech(page);
  await page.goto(`${M}#/timer`);
  await expect(page.locator('#view h1')).toBeVisible();
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await spoken(page)).join(' ')).toMatch(/versus /);
});

test('mute silences every call-out; voice settings persist', async ({ page }) => {
  await mockSpeech(page);
  await page.goto(`${M}#/hq`);
  await page.locator('#voiceBtn').click();
  await expect(page.locator('#voice')).toBeVisible();
  await page.locator('#voice [data-speak="mute"]').check();
  await page.locator('#voice [data-speak="rate"]').fill('1.4');
  await page.locator('#voice [data-speak="rate"]').dispatchEvent('change');
  await page.locator('#voice [data-speak="url"]').fill('http://buddhafield:8137');
  await page.locator('#voice [data-speak="url"]').dispatchEvent('change');
  await page.locator('#voice form button').click();
  await page.reload();
  const p = await page.evaluate(() => window.__speak.getPrefs());
  expect(p).toMatchObject({ muted: true, rate: 1.4, url: 'http://buddhafield:8137' });
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.setPrefs({ url: '' })));
  await page.goto(`${M}#/run`);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  expect(await spoken(page)).toEqual([]);
  // unmute: speech returns at the chosen rate
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.setMuted(false)));
  await page.evaluate(() => window.__run.split());
  await expect.poll(async () => (await page.evaluate(() => window.__spoken)).length).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__spoken))[0].rate).toBe(1.4);
});

test('Breeze TTS 2 is used when it answers; the browser voice takes over when it does not', async ({ page }) => {
  const BREEZE = 'http://breeze.test:8137';
  await mockSpeech(page, { url: BREEZE });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  const bodies = [];
  let up = true;
  await page.route(`${BREEZE}/**`, async route => {
    const req = route.request();
    if (!up) return route.abort();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (req.url().endsWith('/health')) return route.fulfill({ status: 200, headers: cors, body: 'ok' });
    bodies.push(JSON.parse(req.postData()));
    // 0.1 s of silence: signed 16-bit mono PCM at 24 kHz
    return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/octet-stream' }, body: Buffer.alloc(4800) });
  });
  await page.goto(`${M}#/today`);
  await expect(page.locator('#view h1')).toBeVisible();
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.speak('Breeze speaks this.')));
  await expect.poll(() => page.evaluate(() => window.__speak.log.map(l => l.engine))).toContain('breeze');
  expect(bodies[0]).toMatchObject({ model: 'tts-1', input: 'Breeze speaks this.', response_format: 'pcm' });
  expect(await spoken(page)).toEqual([]); // the browser voice stayed quiet
  // Breeze goes away: the next words still get spoken, by the browser
  up = false;
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.checkBreeze(true)));
  await page.evaluate(() => import('./js/lib/speak.js').then(v => v.speak('Browser speaks this.')));
  await expect.poll(() => spoken(page)).toContain('Browser speaks this.');
});

test('Claude panel replies are spoken, and its 🔊 toggle turns that off', async ({ page }) => {
  await mockSpeech(page);
  let served = 0;
  await page.route('**/api/status', r => r.fulfill({ json: { bridge: true } }));
  await page.route('**/api/events', r => {
    served++;
    const ev = served === 1
      ? `data: ${JSON.stringify({ type: 'hello', events: [], busy: false })}\n\ndata: ${JSON.stringify({ type: 'claude', event: { type: 'result', result: 'Your Bridge split is the slowest; drill the dive cancel.' } })}\n\n`
      : `data: ${JSON.stringify({ type: 'hello', events: [], busy: false })}\n\n`;
    return r.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: ev });
  });
  await page.goto(`${M}#/hq`);
  await expect.poll(() => spoken(page)).toContain('Your Bridge split is the slowest; drill the dive cancel.');
  await page.locator('.claude-btn').click();
  const t = page.locator('.claude-panel [data-speak-toggle="claude"]');
  await expect(t).toHaveAttribute('aria-pressed', 'true');
  await t.click();
  await expect(t).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__speak.getPrefs().toggles.claude)).toBe(false);
});
