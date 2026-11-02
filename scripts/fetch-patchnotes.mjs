// Pulls official Dragonwilds announcements from the Steam news API and writes
// data/patchnotes.json for the Patch notes page. Run hourly by
// .github/workflows/patchnotes.yml; run locally with `npm run patchnotes`.
import { writeFile, readFile } from 'node:fs/promises';

const APP = 1374490; // RuneScape: Dragonwilds on Steam
const OUT = new URL('../data/patchnotes.json', import.meta.url);
const URL_ = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP}&count=100&maxlength=0&format=json&feeds=steam_community_announcements`;

// Lines mentioning these are flagged as raid / speedrun relevant.
const RAID = /\b(raid|kuldra|scorned|wilderness|dragontail|vines|fragments|ghornfell|stronghold|cataclysm|keep|sanctum|anima|extraction|garou|thane|abyssal|soulscourge|necromancer|heart(worm)?s?|fog|barrier)\b/i;
const MOVE = /\b(windstep|double[- ]?jump|air ?dash|phase ?dash|surge|recall|dodge|dive|roll|plunge|jump[- ]?attack|animation cancel|stamina|sprint|agility|fleet ?foot|movement|momentum|fall damage|exploit|skip|clip(ping)?|out of bounds|invisible wall|teleport)\b/i;

const clean = s => s
  .replace(/\[img\][^[]*\[\/img\]/gi, '')
  .replace(/\{STEAM_CLAN_IMAGE\}[^\s\]]*/g, '')
  .replace(/\[url=([^\]]+)\]([^[]*)\[\/url\]/gi, '$2')
  .replace(/\[\/?(b|i|u|h\d|list|olist|quote|code|strike|spoiler|table|tr|td|th|p|previewyoutube[^\]]*|carousel[^\]]*|video[^\]]*)\]/gi, '\n')
  .replace(/\[\*\]/g, '\n• ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .split('\n').map(l => l.trim()).filter(Boolean);

const version = t => (t.match(/\b(\d+\.\d+(?:\.\d+){0,2})\b/) || [])[1] || null;

const res = await fetch(URL_);
if (!res.ok) throw new Error('Steam news HTTP ' + res.status);
const items = (await res.json()).appnews.newsitems;
const posts = items.map(n => {
  const lines = clean(n.contents);
  return {
    id: n.gid, date: new Date(n.date * 1000).toISOString().slice(0, 10), title: n.title, url: n.url,
    version: version(n.title), patch: /patch|update|live|hotfix|known issues/i.test(n.title),
    lines: lines.map(text => ({ text, raid: RAID.test(text), move: MOVE.test(text) })),
  };
}).sort((a, b) => b.date.localeCompare(a.date));

const out = { source: `Steam news, app ${APP} (official announcements)`, fetchedAt: new Date().toISOString(), posts };
let prev = null;
try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
if (prev && JSON.stringify(prev.posts) === JSON.stringify(posts)) { console.log('no change'); process.exit(0); }
await writeFile(OUT, JSON.stringify(out) + '\n');
console.log(`wrote ${posts.length} posts, latest: ${posts[0].date} ${posts[0].title}`);
