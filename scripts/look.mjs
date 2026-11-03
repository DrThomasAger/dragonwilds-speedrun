// Lets the in-app Claude see the running app, like a designer glancing at the canvas.
//   node scripts/look.mjs [view] [width] [height]
//   node scripts/look.mjs route            -> screenshot of #/route at the user's screen size
// Prints the PNG path (under D:\claude-temp\look) for Claude to open with its Read tool.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [view = 'hq', w = '1234', hgt = '690'] = process.argv.slice(2);
const dir = 'D:/claude-temp/look';
mkdirSync(dir, { recursive: true });
const out = `${dir}/${view.replace(/[^\w-]/g, '_')}-${w}x${hgt}.png`;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: +w, height: +hgt }, deviceScaleFactor: 1.25 });
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
await p.goto(`http://localhost:${process.env.LAB_PORT || 5180}/?player=mock&nosw=1#/${view}`);
await p.waitForTimeout(1200);
await p.screenshot({ path: out });
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
await b.close();
console.log(out);
if (overflow > 1) console.log(`warning: page scrolls sideways by ${overflow}px`);
if (errors.length) console.log('page errors:\n' + errors.join('\n'));
