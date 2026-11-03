// Compiles every data source into one linked knowledge base for the app's Knowledge page.
//   node scripts/build-kb.mjs        (npm run kb; also hourly in .github/workflows/patchnotes.yml)
// Reads  js/data/*.js, data/patchnotes.json, data/sources.json, data/sources-log.jsonl,
//        data/kb/raw/** (transcripts, comments, chat, threads), data/kb/raw/ingest-log.jsonl,
//        data/kb/analysis/*.json, docs/math/*.md and the git log.
// Never reads data/kb/agents/ (personal AI conversations, gitignored): nothing from it is published.
// Writes data/kb/pages.json  { generated, counts, pages: [page] }
//        data/kb/graph.json  { nodes: [{id, title, type, n}], edges: [[from, to]] }
//        data/kb/daily.json  { days: [{date, items: [{kind, text, id?, url?, at?}]}] }
// page = { id, title, type, summary, props: {k: v}, body: [block], links: [id], sources: [url], updated,
//          backlinks: [{id, ctx: [text]}], mentions: [{id, ctx}] }
// block = {type:'heading'|'paragraph'|'code', text} | {type:'list', items} | {type:'table', title?, columns, fmt?, rows}
//       | {type:'chart', kind:'line'|'bar'|'histogram'|'scatter', title, ...} | {type:'quote', text, author?, source?, url?, t?}
// Inline links in any text: [[page-id]] or [[page-id|label]]; markdown [label](url) also renders.
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, extname, basename } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = (...a) => join(ROOT, ...a);
const now = new Date().toISOString();
const today = now.slice(0, 10);

const { SPLITS, RUNS, RECORD, PATCHES, SRC_SNAPSHOT, RULES, communityBest, targetPace, TARGET_TIME } = await import('../js/data/raid.js');
const { ROUTE, TECH, REQUIREMENTS, OPPORTUNITIES, GEAR } = await import('../js/data/route.js');
const { VIDEOS, BY_KEY, KIND_LABEL } = await import('../js/data/videos.js');
const { WIKI, ENGINE } = await import('../js/data/wiki.js');
const { PHASES } = await import('../js/data/hardcore.js');

// ------------------------------------------------------------------ helpers
const readJson = async (f, d = null) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };
const readJsonl = async f => { try { return (await readFile(f, 'utf8')).split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
async function walk(dir) {
  const out = [];
  let ents = [];
  try { ents = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(f)); else out.push(f);
  }
  return out;
}
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'x';
const L = (id, label) => `[[${id}${label ? '|' + String(label).replace(/[\]|]/g, ' ') : ''}]]`;
const fmtRun = s => { if (s == null || !isFinite(s)) return '—'; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, '0')}`; };
const fmtClock = s => { s = Math.max(0, Math.floor(s)); const hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return hh ? `${hh}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };
const ytUrl = (vid, t) => `https://www.youtube.com/watch?v=${vid}${t ? `&t=${Math.floor(t)}s` : ''}`;
const twUrl = (vid, t) => { t = Math.floor(t || 0); return `https://www.twitch.tv/videos/${vid}${t ? `?t=${Math.floor(t / 3600)}h${Math.floor(t / 60) % 60}m${t % 60}s` : ''}`; };
const dateOf = x => { if (!x) return null; const m = String(x).match(/\d{4}-\d{2}-\d{2}/); if (m) return m[0]; const n = typeof x === 'number' ? new Date(x > 1e12 ? x : x * 1000) : null; return n && !isNaN(n) ? n.toISOString().slice(0, 10) : null; };
const maxDate = (...ds) => ds.filter(Boolean).sort().pop() || null;
const trunc = (s, n = 240) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const num = x => (typeof x === 'number' ? x : parseFloat(x));

const pages = new Map();
const moments = new Map();     // target id -> [{quote block}]
function addMoment(target, q) { if (!moments.has(target)) moments.set(target, []); moments.get(target).push(q); }
const days = new Map();
const addDay = (date, item) => { date = dateOf(date); if (!date) return; if (!days.has(date)) days.set(date, []); days.get(date).push(item); };
function page(id, type, title, o = {}) {
  let p = pages.get(id);
  if (!p) { p = { id, title, type, summary: '', props: {}, body: [], links: [], sources: [], updated: null, terms: [] }; pages.set(id, p); }
  if (title && (!p.title || p.title === p.id || p.title === p.id.slice(p.id.indexOf(':') + 1))) p.title = title;
  if (o.summary && !p.summary) p.summary = o.summary;
  Object.assign(p.props, o.props || {});
  if (o.body) p.body.push(...o.body);
  if (o.links) p.links.push(...[].concat(o.links).filter(x => typeof x === 'string'));
  if (o.sources) p.sources.push(...[].concat(o.sources).filter(x => typeof x === 'string' && x));
  if (o.updated) p.updated = maxDate(p.updated, dateOf(o.updated));
  if (o.terms) p.terms.push(...o.terms);
  return p;
}
const has = id => pages.has(id);

// ------------------------------------------------------------------ people
const peopleRuns = new Map();         // slug -> name of anyone with a run
for (const r of RUNS) peopleRuns.set(slug(r.runner), r.runner);
const sources = await readJson(P('data/sources.json'), { items: {} });
const srcItems = Object.values(sources.items || {});
const srcRuns = srcItems.filter(i => i.kind === 'run');
const runnerOf = t => String(t).replace(/\s+\d+:\d{2}(\.\d+)?$/, '').trim();
for (const i of srcRuns) for (const n of runnerOf(i.title).split(/\s*&\s*/)) peopleRuns.set(slug(n), n);
const SR = P('data/kb/raw/speedrun');
const srRaw = await readJson(join(SR, 'runs.json'), { runs: [] });
const srUsers = await readJson(join(SR, 'users.json'), {});
const srRules = await readJson(join(SR, 'rules.json'), null);
for (const r of srRaw.runs || []) for (const n of r.players || []) peopleRuns.set(slug(n), n);
const personId = name => (peopleRuns.has(slug(name)) ? 'runner:' : 'channel:') + slug(name);
function person(name, extra = {}) {
  name = String(name).trim();
  if (!name) return null;
  const id = personId(name);
  page(id, id.startsWith('runner:') ? 'runner' : 'channel', name, { terms: name.length >= 4 ? [name] : [], ...extra });
  return id;
}
const creditIds = credit => String(credit || '').replace(/ run notes/g, '').replace(/\([^)]*\)?/g, '').split(/[,;/]|\band\b|&/).map(s => s.trim()).filter(s => s && s.length < 30).map(n => person(n));

// ------------------------------------------------------------------ source sites
const SITES = [
  ['source:speedrun-com', 'speedrun.com', /speedrun\.com/, 'Leaderboard, run submissions and the Raid category rules.'],
  ['source:youtube', 'YouTube', /youtube\.com|youtu\.be/, 'Run videos, skip guides and tech clips; every clip in the app plays from its creator\'s channel.'],
  ['source:steam', 'Steam patch notes', /steampowered|steamstore|steamcommunity/, 'Official Jagex patch notes, mirrored hourly into data/patchnotes.json.'],
  ['source:rs-wiki', 'RuneScape: Dragonwilds Wiki', /runescape\.wiki/, 'Community wiki; the mechanics entries cite it per fact.'],
  ['source:twitch', 'Twitch', /twitch\.tv/, 'Streams and VODs with chat.'],
  ['source:reddit', 'Reddit', /reddit\.com/, 'Community threads and comments.'],
  ['source:jagex', 'Jagex', /jagex\.com/, 'Developer announcements.'],
];
for (const [id, title, , summary] of SITES) page(id, 'source', title, { summary, terms: id === 'source:speedrun-com' ? ['speedrun.com'] : [] });
const siteOf = url => (SITES.find(s => s[2].test(url)) || [])[0];

// ------------------------------------------------------------------ splits + runs
const best = communityBest();
const pace = targetPace();
const ZONE_WIKI = ['dragontail-vines', 'fragments-of-ghornfell', 'shattered-stronghold', 'cataclysm-keep', 'kuldras-sanctum'];
const seg = (r, k) => r.splits[k] - (k ? r.splits[k - 1] : 0);
const wr = RUNS.find(r => r.key === RECORD.key);

SPLITS.forEach((s, k) => {
  const id = `split:${k + 1}`;
  const rows = RUNS.map(r => [L('run:' + r.key, r.label), +seg(r, k).toFixed(2), +r.splits[k].toFixed(2), +(seg(r, k) - best[k].seg).toFixed(2), `[▶ ${fmtClock(r.offset + (k ? r.splits[k - 1] : 0))}](${ytUrl(r.vid, r.offset + (k ? r.splits[k - 1] : 0))})`]);
  page(id, 'split', `${k + 1}. ${s.name}`, {
    summary: `Split ${k + 1} of 5. ${ROUTE[k]?.summary || ''}`,
    props: { 'Split': `${k + 1} of 5`, 'Zone': L('wiki:' + ZONE_WIKI[k], s.name), 'Community best': `${fmtRun(best[k].seg)} (${L('run:' + best[k].run, best[k].runner)})`, 'Target pace (cumulative)': fmtRun(pace[k]), 'WR segment': fmtRun(seg(wr, k)), 'Ends on': k < 4 ? 'EXTRACTION POINT UNLOCKED banner' : 'Cut to black after GET OUT NOW!' },
    body: [
      { type: 'heading', text: 'Every reference run' },
      { type: 'table', columns: ['Run', 'Segment', 'Split at', 'vs best', 'Watch'], fmt: [null, 'time', 'time', 'delta', null], rows },
      { type: 'chart', kind: 'bar', title: `Segment time per run · ${s.name}`, fmt: 'time', labels: RUNS.map(r => r.label.replace(/ \(.*\)$/, '')), series: [{ name: 'Segment', values: RUNS.map(r => +seg(r, k).toFixed(2)) }] },
      { type: 'heading', text: 'Skips in this split' },
      { type: 'list', items: (ROUTE[k]?.skips || []).map(x => `${L('skip:' + x.id, x.name)} — ${x.status}`) },
    ],
    links: [k ? `split:${k}` : null, k < 4 ? `split:${k + 2}` : null].filter(Boolean),
    terms: [s.name], updated: today,
  });
});

for (const r of RUNS) {
  const rid = 'run:' + r.key, pid = person(r.runner);
  const v = BY_KEY[r.key];
  const rows = SPLITS.map((s, k) => [L(`split:${k + 1}`, s.name), +seg(r, k).toFixed(2), +r.splits[k].toFixed(2), +(r.splits[k] - wr.splits[k]).toFixed(2), +(seg(r, k) - best[k].seg).toFixed(2), `[▶ ${fmtClock(r.offset + (k ? r.splits[k - 1] : 0))}](${ytUrl(r.vid, r.offset + (k ? r.splits[k - 1] : 0))})`]);
  page(rid, 'run', r.label, {
    summary: `${r.runner} — ${fmtRun(r.time)} on ${r.patch}, ${r.date}. Split marks measured frame by frame (${r.precision}).${r.note ? ' ' + r.note : ''}`,
    props: { Runner: L(pid, r.runner), Time: fmtRun(r.time), Date: r.date, Patch: r.patch, Precision: r.precision, Video: L('video:' + r.vid, v ? v.title : r.vid), 'Timer offset': `${r.offset} s`, ...(r.sob ? { 'Runner sum of best': fmtRun(r.sob) } : {}), ...(r.src ? { 'speedrun.com': `[${r.src}](https://www.speedrun.com/Runescape_Dragonwilds/runs/${r.src})` } : {}) },
    body: [
      { type: 'heading', text: 'Splits' },
      { type: 'table', columns: ['Split', 'Segment', 'Cumulative', 'vs WR', 'vs community best', 'Watch'], fmt: [null, 'time', 'time', 'delta', 'delta', null], rows },
      { type: 'chart', kind: 'line', title: 'Cumulative delta to the WR at each split', fmt: 'delta', xLabels: SPLITS.map(s => s.short), series: [{ name: r.label, points: SPLITS.map((_, k) => [k + 1, +(r.splits[k] - wr.splits[k]).toFixed(2)]) }] },
      ...(r.moments ? [{ type: 'heading', text: 'Moments' }, ...r.moments.map(([t, q]) => ({ type: 'quote', text: q, author: r.runner, source: 'video:' + r.vid, url: ytUrl(r.vid, t), t }))] : []),
    ],
    links: [pid, 'video:' + r.vid], sources: [ytUrl(r.vid), r.src ? `https://www.speedrun.com/Runescape_Dragonwilds/runs/${r.src}` : null], updated: r.date,
  });
}
// speedrun.com runs (verified + pending) not already a reference run
const srcToKey = Object.fromEntries(RUNS.filter(r => r.src).map(r => [r.src, r.key]));
for (const i of srcRuns) {
  const srcId = i.key.replace(/^src:/, '');
  const id = srcToKey[srcId] ? 'run:' + srcToKey[srcId] : 'run:src-' + srcId;
  const names = runnerOf(i.title).split(/\s*&\s*/);
  const ids = names.map(n => person(n));
  const vid = (String(i.video || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1];
  page(id, 'run', i.title, {
    summary: `${names.join(' & ')} — ${fmtRun(i.time)} (${i.bracket}), ${i.status} on speedrun.com.`,
    props: { Runner: ids.map((p, j) => L(p, names[j])).join(', '), Time: fmtRun(i.time), Date: i.date, Bracket: i.bracket, Status: i.status, 'speedrun.com': `[${srcId}](${i.url})`, ...(vid ? { Video: L('video:' + vid) } : {}) },
    links: [...ids, 'source:speedrun-com', vid ? 'video:' + vid : null].filter(Boolean), sources: [i.url], updated: i.date,
  });
  if (vid) page('video:' + vid, 'video', vid, { sources: [ytUrl(vid)] });
}
// Comparison chart for the split hub
page('kb:splits', 'index', 'All splits compared', {
  summary: 'Every reference run, segment by segment, against the community best and the target pace for beating 6:50.',
  body: [
    { type: 'table', columns: ['Split', ...RUNS.map(r => r.runner + ' ' + fmtRun(r.time).replace(/\.\d+$/, '')), 'Best', 'Target'], fmt: [null, ...RUNS.map(() => 'time'), 'time', 'time'],
      rows: SPLITS.map((s, k) => [L(`split:${k + 1}`, s.name), ...RUNS.map(r => +seg(r, k).toFixed(2)), +best[k].seg.toFixed(2), +(pace[k] - (k ? pace[k - 1] : 0)).toFixed(2)]) },
    { type: 'chart', kind: 'line', title: 'Cumulative time at each split', fmt: 'time', xLabels: SPLITS.map(s => s.short), series: RUNS.map(r => ({ name: r.label.replace(/ \(.*\)$/, ''), points: r.splits.map((t, k) => [k + 1, t]) })) },
    { type: 'chart', kind: 'scatter', title: 'Final time vs run date', fmt: 'time', xType: 'date', series: [{ name: 'Reference runs', points: RUNS.map(r => [r.date, r.time, r.label]) }, { name: 'speedrun.com', points: srcRuns.map(i => [i.date, i.time, i.title]) }] },
  ],
  links: SPLITS.map((_, k) => `split:${k + 1}`),
});

// ------------------------------------------------------------------ route: skips, techniques, requirements
const SKIP_TERMS = {
  's-airvent': ['air anima', 'air vent'], 's-soul': ['soulscourge skip'], 's-bd1': ['black dragon skip'], 's-necro': ['necro land', 'necromancer area', 'zoop'],
  's-vines-old': ['vines skip'], 's-poison': ['poison area'], 's-demon': ['past the demon', 'abyssal demon skip'], 's-thane': ['air door', 'thane skip', 'through the gate'],
  's-parkour': ['parkour'], 's-keep': ['keep hole', 'elemental puzzle', 'hole in keep'], 's-kuldra': ['kuldra skip', 'fight skip', 'skip the kuldra fight'],
  's-flight': ['fly through', 'flying', 'flight'], 's-heart': ['heartworms', 'where to stand'],
  'tech-dive': ['dive cancel', 'plunge cancel', 'jump attack cancel', 'jump-attack cancel'], 'tech-infjump': ['infinite jump', 'infinite double jump'], 'tech-surge': ['surge combo', 'phase dash + surge'],
};
const clipRow = c => [L('video:' + c.vid, (VIDEOS.find(v => v.id === c.vid) || {}).title || c.vid), c.label || '', `[▶ ${fmtClock(c.in)}–${fmtClock(c.out)}](${ytUrl(c.vid, c.in)})`, +(c.out - c.in).toFixed(1)];
function skipPage(s, k, type) {
  const id = (type === 'technique' ? 'tech:' : 'skip:') + s.id;
  const reqs = REQUIREMENTS.filter(r => r.used.includes(s.id) || r.used.includes('*'));
  const credits = creditIds(s.credit);
  page(id, type, s.name, {
    summary: s.text || `${type === 'technique' ? 'Movement technique' : `Route skip in ${L(`split:${k + 1}`, SPLITS[k].name)}`}, credited to ${s.credit || 'the community'}. ${{ works: 'Works on the current patch.', new: 'New — found after the record runs.', check: 'Unconfirmed on the current patch — test before routing.' }[s.status] || ''}`,
    props: { Status: s.status, ...(k != null ? { Split: L(`split:${k + 1}`, SPLITS[k].name) } : {}), Credit: credits.map(c => L(c)).join(', ') || '—', Clips: s.clips.length, Practice: `[Drill it](#/practice?skip=${s.id})` },
    body: [
      ...(s.how && s.how.length ? [{ type: 'heading', text: 'How' }, { type: 'list', ordered: true, items: s.how }] : []),
      ...(s.clips.length ? [{ type: 'heading', text: 'Clips' }, { type: 'table', columns: ['Video', 'Clip', 'Watch', 'Length (s)'], fmt: [null, null, null, 'num'], rows: s.clips.map(clipRow) }] : []),
      ...(reqs.length ? [{ type: 'heading', text: 'Needs' }, { type: 'list', items: reqs.map(r => `${L('req:' + r.id, r.name)} — ${r.need}`) }] : []),
    ],
    links: [...credits, ...s.clips.map(c => 'video:' + c.vid), k != null ? `split:${k + 1}` : null].filter(Boolean),
    sources: s.clips.map(c => ytUrl(c.vid, c.in)), terms: SKIP_TERMS[s.id] || [], updated: today,
  });
  for (const c of s.clips) page('video:' + c.vid, 'video', c.vid, {});
}
ROUTE.forEach((sp, k) => sp.skips.forEach(s => skipPage(s, k, 'skip')));
TECH.forEach(s => skipPage(s, null, 'technique'));

for (const r of REQUIREMENTS) {
  const used = r.used.includes('*') ? ROUTE.flatMap(sp => sp.skips.map(s => 'skip:' + s.id)) : r.used.map(u => (u.startsWith('tech-') ? 'tech:' : 'skip:') + u);
  page('req:' + r.id, 'requirement', r.name, {
    summary: `${r.kind[0].toUpperCase() + r.kind.slice(1)} — ${r.need}.${r.note ? ' ' + r.note : ''}`,
    props: { Kind: r.kind, Need: r.need, 'Unlocked in': L('phase:' + r.phase), Wiki: L('wiki:' + r.wiki) },
    body: used.length ? [{ type: 'heading', text: 'Used by' }, { type: 'list', items: used.map(u => L(u)) }] : [],
    links: [...used, 'phase:' + r.phase, 'wiki:' + r.wiki], terms: r.name.length >= 5 && !/^Any|Best/.test(r.name) ? [r.name] : [], updated: today,
  });
}
for (const ph of PHASES) {
  const reqs = REQUIREMENTS.filter(r => r.phase === ph.id);
  page('phase:' + ph.id, 'phase', ph.title, {
    summary: `${ph.sub}. ${trunc(ph.intro, 300)}`,
    props: Object.fromEntries((ph.kv || []).map(([k, v]) => [k, v])),
    body: [
      { type: 'heading', text: 'Segments' }, { type: 'list', items: (ph.segs || []).map(s => s.t) },
      ...(reqs.length ? [{ type: 'heading', text: 'Raid unlocks here' }, { type: 'list', items: reqs.map(r => L('req:' + r.id, r.name)) }] : []),
      { type: 'paragraph', text: `[Open in the Hardcore checklist](#/hardcore)` },
    ],
    links: reqs.map(r => 'req:' + r.id),
  });
}

// ------------------------------------------------------------------ wiki
for (const w of WIKI) {
  const id = 'wiki:' + w.id;
  const reqs = REQUIREMENTS.filter(r => r.wiki === w.id);
  page(id, 'wiki', w.title, {
    summary: w.summary,
    props: { Category: w.cat, ...Object.fromEntries((w.facts || []).slice(0, 8)) },
    body: [
      ...((w.facts || []).length > 8 ? [{ type: 'table', title: 'All facts', columns: ['Fact', 'Value'], rows: w.facts }] : []),
      ...(w.speedrun?.length ? [{ type: 'heading', text: 'For speedrunning' }, { type: 'list', items: w.speedrun }] : []),
      ...(w.patches?.length ? [{ type: 'heading', text: 'Patch history' }, { type: 'list', items: w.patches.map(([v, t]) => `${PATCHES.some(p => p.v === v) ? L('patch:' + v, v) : v} — ${t}`) }] : []),
      ...(reqs.length ? [{ type: 'heading', text: 'Raid requirement' }, { type: 'list', items: reqs.map(r => `${L('req:' + r.id, r.name)} — ${r.need}`) }] : []),
      ...(w.related?.length ? [{ type: 'heading', text: 'Related' }, { type: 'list', items: w.related.map(r => L('wiki:' + r)) }] : []),
      { type: 'paragraph', text: `[Open in the Mechanics wiki](#/wiki?id=${w.id})` },
    ],
    links: [...(w.related || []).map(r => 'wiki:' + r), ...reqs.map(r => 'req:' + r.id)],
    sources: w.sources || [], terms: [w.title.replace(/\s*\(.*\)$/, ''), ...(w.aliases || [])], updated: today,
  });
}
if (ENGINE) page('wiki:unreal-engine', 'wiki', 'Unreal Engine 5', { body: [{ type: 'heading', text: 'Engine notes' }, { type: 'list', items: ENGINE.notes }], sources: ENGINE.sources });
page('wiki:speedrun-rules', 'wiki', 'Raid category rules', { body: [{ type: 'table', title: 'Rules as published', columns: ['Rule', 'Text'], rows: Object.entries(RULES).map(([k, v]) => [k, v]) }] });

// ------------------------------------------------------------------ patches (routing history + official posts)
const notes = await readJson(P('data/patchnotes.json'), { posts: [] });
const postByVersion = Object.fromEntries(notes.posts.filter(p => p.version).map(p => [p.version, p]));
for (const x of PATCHES) {
  const id = 'patch:' + x.v, post = postByVersion[x.v];
  const vids = (x.src || []).map(k => BY_KEY[k]).filter(Boolean);
  page(id, 'patch', `Patch ${x.v}`, {
    summary: x.text,
    props: { Version: x.v, Date: x.date, ...(x.url ? { 'Official notes': `[Steam](${x.url})` } : {}) },
    body: [
      ...(x.quote ? [{ type: 'quote', text: x.quote, author: 'Jagex patch notes', url: x.url }] : []),
      ...(vids.length ? [{ type: 'heading', text: 'Runs and videos from this patch' }, { type: 'list', items: vids.map(v => `${L('video:' + v.id, v.title)} — ${v.author}`) }] : []),
    ],
    links: vids.map(v => 'video:' + v.id), sources: [x.url], terms: [x.v.replace(/\+$/, '')].filter(v => /\d\.\d/.test(v) && v.length >= 5), updated: x.date,
  });
}
for (const post of notes.posts) {
  const id = post.version ? 'patch:' + post.version : 'news:' + post.id;
  const flagged = post.lines.filter(l => l.raid || l.move);
  const shown = (post.patch || flagged.length ? post.lines : post.lines.slice(0, 14)).filter(l => l.text.length > 2 && !/^\[\/?\*?\]|^•$/.test(l.text)).slice(0, 120);
  page(id, post.version || post.patch ? 'patch' : 'news', post.version ? `Patch ${post.version}` : post.title, {
    summary: flagged.length ? `${flagged.length} raid / movement line${flagged.length > 1 ? 's' : ''}: ${trunc(flagged[0].text, 160)}` : trunc(post.title, 200),
    props: { Title: post.title, Date: post.date, 'Official notes': `[Steam](${post.url})`, 'Raid lines': flagged.length },
    body: [
      ...(flagged.length ? [{ type: 'heading', text: 'Raid and movement lines' }, ...flagged.map(l => ({ type: 'quote', text: l.text, author: `Jagex · ${post.version || post.date}`, url: post.url }))] : []),
      { type: 'heading', text: 'Full notes' }, { type: 'list', items: shown.map(l => l.text) },
    ],
    links: ['source:steam'], sources: [post.url], updated: post.date,
  });
}
const patchRows = PATCHES.map(x => [L('patch:' + x.v, x.v), x.date, trunc(x.text, 140)]);
page('kb:patches', 'index', 'Patch history', {
  summary: 'Every patch that changed how the raid is routed, from release to the current version, plus all official posts.',
  body: [{ type: 'table', columns: ['Version', 'Date', 'What changed for runners'], rows: patchRows },
    { type: 'chart', kind: 'bar', title: 'Raid / movement lines per official post (latest 20)', labels: notes.posts.slice(0, 20).reverse().map(p => p.version || p.date), series: [{ name: 'Raid + movement lines', values: notes.posts.slice(0, 20).reverse().map(p => p.lines.filter(l => l.raid || l.move).length) }] }],
  links: PATCHES.map(x => 'patch:' + x.v),
});

// ------------------------------------------------------------------ videos
const seenVideo = new Set();
for (const v of VIDEOS) {
  seenVideo.add(v.id);
  const aid = person(v.author);
  const run = RUNS.find(r => r.vid === v.id);
  const clipsHere = [];
  ROUTE.forEach(sp => sp.skips.forEach(s => s.clips.filter(c => c.vid === v.id).forEach(c => clipsHere.push(['skip:' + s.id, s.name, c]))));
  TECH.forEach(s => s.clips.filter(c => c.vid === v.id).forEach(c => clipsHere.push(['tech:' + s.id, s.name, c])));
  page('video:' + v.id, 'video', v.title, {
    summary: v.note || `${KIND_LABEL[v.kind] || v.kind} by ${v.author}, ${v.date}${v.patch ? ` (patch ${v.patch})` : ''}.`,
    props: { Channel: L(aid, v.author), Kind: KIND_LABEL[v.kind] || v.kind, Published: v.date, Length: fmtClock(v.dur), Patch: v.patch || '—', ...(v.patched ? { Note: 'Strats since patched' } : {}), ...(run ? { Run: L('run:' + run.key, run.label) } : {}), Watch: `[YouTube](${ytUrl(v.id)})` },
    body: [
      ...(v.chapters ? [{ type: 'heading', text: 'Chapters' }, { type: 'list', items: v.chapters.map(([t, l]) => `[${fmtClock(t)}](${ytUrl(v.id, t)}) ${l}`) }] : []),
      ...(clipsHere.length ? [{ type: 'heading', text: 'Clips used in the route' }, { type: 'table', columns: ['Skip', 'Clip', 'Watch'], rows: clipsHere.map(([id, n, c]) => [L(id, n), c.label || '', `[▶ ${fmtClock(c.in)}–${fmtClock(c.out)}](${ytUrl(v.id, c.in)})`]) }] : []),
    ],
    links: [aid, run ? 'run:' + run.key : null, 'source:youtube'].filter(Boolean), sources: [ytUrl(v.id)], updated: v.date,
  });
}
for (const i of srcItems.filter(i => i.kind === 'video')) {
  const vid = i.key.replace(/^yt:/, '');
  const aid = i.author ? person(i.author) : null;
  const known = seenVideo.has(vid);
  page('video:' + vid, 'video', i.title, {
    summary: known ? '' : `Found by the hourly source tracker (${i.published || 'date unknown'}); not yet reviewed into the library.`,
    props: { ...(aid ? { Channel: L(aid, i.author) } : {}), ...(i.length ? { Length: i.length } : {}), 'First seen': dateOf(i.firstSeen), ...(known ? {} : { Status: 'new — unreviewed' }), Watch: `[YouTube](${i.url})` },
    links: [aid, 'source:youtube'].filter(Boolean), sources: [i.url], updated: dateOf(i.lastSeen || i.firstSeen),
  });
}

// ------------------------------------------------------------------ math docs + analysis results (other pipelines)
function mdBlocks(md) {
  const out = [];
  const lines = md.replace(/\r/g, '').split('\n');
  let para = [], list = null, code = null;
  const flush = () => { if (para.length) out.push({ type: 'paragraph', text: para.join(' ') }); para = []; if (list) out.push(list); list = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (code) { if (/^```/.test(l)) { out.push({ type: 'code', text: code.join('\n') }); code = null; } else code.push(l); continue; }
    if (/^```/.test(l)) { flush(); code = []; continue; }
    if (/^\s*$/.test(l)) { flush(); continue; }
    let m;
    if ((m = l.match(/^(#{1,6})\s+(.*)/))) { flush(); out.push({ type: 'heading', text: m[2], level: m[1].length }); continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || '') && /-/.test(lines[i + 1] || '')) {
      flush();
      const cells = s => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const columns = cells(l); const rows = []; i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i]).map(c => (/^-?\d+(\.\d+)?$/.test(c) ? +c : c))); i++; }
      i--; out.push({ type: 'table', columns, rows }); continue;
    }
    if ((m = l.match(/^\s*>\s?(.*)/))) { flush(); out.push({ type: 'quote', text: m[1] }); continue; }
    if ((m = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)/))) { if (para.length) { out.push({ type: 'paragraph', text: para.join(' ') }); para = []; } list ||= { type: 'list', ordered: /\d/.test(m[1]), items: [] }; list.items.push(m[2]); continue; }
    if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += ' ' + l.trim(); continue; }
    para.push(l.trim());
  }
  if (code) out.push({ type: 'code', text: code.join('\n') });
  flush();
  return out;
}
const mathFiles = (await walk(P('docs/math'))).filter(f => extname(f) === '.md');
for (const f of mathFiles) {
  const md = await readFile(f, 'utf8');
  const blocks = mdBlocks(md);
  const h1 = blocks.findIndex(b => b.type === 'heading' && b.level === 1);
  const title = h1 >= 0 ? blocks.splice(h1, 1)[0].text : basename(f, '.md').replace(/[-_]/g, ' ');
  const firstPara = blocks.find(b => b.type === 'paragraph');
  const st = await stat(f);
  page('math:' + slug(basename(f, '.md')), 'math', title, { summary: firstPara ? trunc(firstPara.text, 300) : '', body: blocks, props: { File: `docs/math/${basename(f)}` }, updated: st.mtime.toISOString() });
}

const BLOCK_TYPES = new Set(['heading', 'paragraph', 'list', 'table', 'chart', 'quote', 'code']);
// Key -> page link when an analysis value names a known entity (skip ids, run keys, wiki ids…).
function linkify(v) {
  if (typeof v !== 'string') return v;
  for (const pre of ['', 'skip:', 'tech:', 'run:', 'wiki:', 'req:', 'split:', 'phase:']) if (has(pre + v)) return L(pre + v, v);
  const r = 'runner:' + slug(v); if (has(r)) return L(r, v);
  return v;
}
const round = x => (Math.abs(x) >= 100 ? Math.round(x * 100) / 100 : +x.toPrecision(4));
const cell = x => (x == null ? '' : typeof x === 'number' ? round(x) : Array.isArray(x) ? (x.every(y => typeof y === 'number') ? x.map(round).join(', ') : x.every(y => typeof y !== 'object') ? x.join(', ') : JSON.stringify(x).slice(0, 120)) : typeof x === 'object' ? JSON.stringify(x).slice(0, 120) : linkify(x));
const isScalarish = x => x == null || typeof x !== 'object' || (Array.isArray(x) && x.length <= 12 && x.every(y => y == null || typeof y !== 'object'));
function genericBody(j, skip = new Set(), depth = 0) {
  const body = [];
  for (const [k, v] of Object.entries(j)) {
    if (skip.has(k) || k.startsWith('_')) continue;
    if (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
      const cols = [...new Set(v.slice(0, 50).flatMap(o => Object.keys(o).filter(c => isScalarish(o[c]))))].slice(0, 12);
      if (cols.length) body.push({ type: 'table', title: k, columns: cols, rows: v.slice(0, 400).map(o => cols.map(c => cell(o[c]))) });
    } else if (Array.isArray(v) && v.length > 12 && v.every(x => typeof x === 'number')) {
      body.push({ type: 'chart', kind: 'histogram', title: k, values: v.slice(0, 5000) });
    } else if (Array.isArray(v) && v.length && v.every(x => typeof x === 'number')) {
      body.push({ type: 'table', title: k, columns: ['#', k], rows: v.map((x, i) => [i + 1, round(x)]) });
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const ents = Object.entries(v);
      const objs = ents.filter(([, x]) => x && typeof x === 'object' && !Array.isArray(x));
      // map of records (e.g. {"s-thane": {loss, fatal, why}}) -> one table, key column linked
      if (objs.length >= 2 && objs.length === ents.length && objs.every(([, x]) => Object.values(x).every(isScalarish))) {
        const cols = [...new Set(objs.flatMap(([, x]) => Object.keys(x)))].slice(0, 11);
        body.push({ type: 'table', title: k, columns: ['Key', ...cols], rows: objs.map(([kk, x]) => [linkify(kk), ...cols.map(c => cell(x[c]))]) });
        continue;
      }
      const sc = ents.filter(([, x]) => isScalarish(x));
      if (sc.length) body.push({ type: 'table', title: k, columns: ['Key', 'Value'], rows: sc.slice(0, 200).map(([a, b]) => [linkify(a), cell(b)]) });
      if (depth < 3) {
        const nested = genericBody(Object.fromEntries(ents.filter(([, x]) => !isScalarish(x))), new Set(), depth + 1);
        body.push(...nested.map(b => (b.title ? { ...b, title: `${k} · ${b.title}` } : b)));
      }
    }
  }
  return body;
}
const analysisFiles = (await walk(P('data/kb/analysis'))).filter(f => extname(f) === '.json');
for (const f of analysisFiles) {
  const j = await readJson(f);
  if (!j || typeof j !== 'object' || j._synthetic) continue;      // synthetic test exports are not knowledge
  const docs = Array.isArray(j) ? [{ title: basename(f, '.json'), rows: j }] : [j];
  for (const d of docs) {
    const name = basename(f, '.json');
    const id = d.id && /:/.test(d.id) ? d.id : 'analysis:' + slug(d.id || name);
    const reserved = new Set(['id', 'title', 'summary', 'description', 'blocks', 'body', 'charts', 'links', 'sources', 'updated', 'generated', 'generatedAt', 'props']);
    const props = { ...(d.props || {}), ...Object.fromEntries(Object.entries(d).filter(([k, v]) => !reserved.has(k) && !k.startsWith('_') && v != null && typeof v !== 'object').slice(0, 14)), File: `data/kb/analysis/${basename(f)}` };
    const given = [...(d.blocks || []), ...(Array.isArray(d.body) ? d.body : [])].filter(b => b && BLOCK_TYPES.has(b.type));
    const charts = (d.charts || []).filter(c => c && c.kind).map(c => ({ type: 'chart', ...c }));
    const body = [...given, ...charts, ...(given.length ? [] : genericBody(d, reserved))];
    const st = await stat(f);
    page(id, 'analysis', d.title || (name[0].toUpperCase() + name.slice(1)).replace(/[-_.]/g, ' '), { summary: d.summary || d.description || '', props, body, links: (d.links || []).filter(x => typeof x === 'string'), sources: d.sources || [], updated: d.updated || d.generatedAt || d.generated || st.mtime.toISOString() });
  }
}

// CSV tables from the analysis pipeline: one table per file (attached to the JSON page of
// the same name when there is one) with a bar chart of its first numeric columns.
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(x => x !== ''));
}
const csvFiles = (await walk(P('data/kb/analysis'))).filter(f => extname(f) === '.csv');
for (const f of csvFiles) {
  const [cols, ...raw] = parseCsv(await readFile(f, 'utf8'));
  if (!cols) continue;
  const synth = r => cols.some((c, i) => (c === 'synthetic' && r[i] === 'true') || /SYNTHETIC/.test(r[i]));
  const rows = raw.filter(r => !synth(r)).map(r => r.map(x => (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(x) ? +x : x)));
  if (!rows.length) continue;
  const keep = cols.map((c, i) => c !== 'synthetic' && rows.some(r => r[i] !== '' && r[i] != null));
  const C = cols.filter((_, i) => keep[i]), R = rows.map(r => r.filter((_, i) => keep[i]).map(x => (typeof x === 'number' ? round(x) : linkify(x))));
  const name = basename(f, '.csv');
  const labelCol = ['name', 'label', 'run', 'skip', 'routeName', 'what', 'title', 'route'].map(c => C.indexOf(c)).find(i => i >= 0);
  const numCols = C.map((c, i) => i).filter(i => !['split', 'rank', 'n', 'nRun', 'nPractice', 'attempts', 'made', 'missed'].includes(C[i]) && R.every(r => typeof r[i] === 'number'));
  const body = [{ type: 'table', title: `${name}.csv`, columns: C, rows: R }];
  if (labelCol != null && numCols.length && R.length <= 24) {
    const pick = numCols.slice(0, 3);
    const scale = pick.map(i => Math.max(...R.map(r => Math.abs(r[i]))));
    const same = pick.filter((i, j) => scale[j] / scale[0] < 20 && scale[0] / scale[j] < 20);
    body.push({ type: 'chart', kind: 'bar', title: `${name}: ${same.map(i => C[i]).join(', ')}`, labels: R.map(r => String(r[labelCol]).replace(/\[\[[^|\]]+\|?([^\]]*)\]\]/g, '$1').slice(0, 40)), series: same.map(i => ({ name: C[i], values: R.map(r => r[i]) })) });
  }
  const jsonId = 'analysis:' + slug(name);
  const st = await stat(f);
  if (has(jsonId)) page(jsonId, 'analysis', null, { body, updated: st.mtime.toISOString() });
  else page('analysis:' + slug(name) + '-csv', 'analysis', (name[0].toUpperCase() + name.slice(1)).replace(/[-_]/g, ' ') + ' (table)', {
    summary: `${R.length} rows × ${C.length} columns from data/kb/analysis/${basename(f)}.`, props: { File: `data/kb/analysis/${basename(f)}`, Rows: R.length }, body, updated: st.mtime.toISOString(),
  });
}

// ------------------------------------------------------------------ optimal run path (data/kb/runpath.json + docs/runpath.md)
const runpath = await readJson(P('data/kb/runpath.json'));
let runpathMd = null; try { runpathMd = await readFile(P('docs/runpath.md'), 'utf8'); } catch { /* not written */ }
const vt = ts => String(ts).split(':').reduce((a, b) => a * 60 + +b, 0);
if (runpath) {
  const rk = Object.keys(runpath.run_times || {});
  const label = { tp650: 'TexasPete 6:50', nano: 'Nanobit 7:01', tp740: 'TexasPete 7:40', samf: 'SamFPlays 10:53' };
  const runId = k => (k === 'nano' ? 'run:nano701' : k === 'samf' ? 'run:samf11' : 'run:' + k);
  const tgt = Object.fromEntries((runpath.target?.per_segment || []).map(t => [t.seg, t]));
  const segs = runpath.segments || [];
  const md = runpathMd ? mdBlocks(runpathMd) : [];
  const h1 = md.findIndex(b => b.type === 'heading' && b.level === 1); if (h1 >= 0) md.splice(h1, 1);
  page('kb:runpath', 'analysis', `Optimal run path — target ${fmtRun(runpath.target?.total)}`, {
    summary: `Goal: ${runpath.goal}. Segment-by-segment best line from frame-timed record runs; target pace ${fmtRun(runpath.target?.total)} (sum of best on any patch ${fmtRun(runpath.totals?.sum_of_best_any_patch)}, 1.0.1.2-valid composite ${fmtRun(runpath.totals?.composite_1012_valid_incl_unverified)}).`,
    props: { Target: fmtRun(runpath.target?.total), 'Sum of best (any patch)': fmtRun(runpath.totals?.sum_of_best_any_patch), '1.0.1.2 composite (incl. unverified)': fmtRun(runpath.totals?.composite_1012_valid_incl_unverified), 'Strictly verified composite': fmtRun(runpath.totals?.composite_strict_verified), Checkpoints: Object.keys(runpath.checkpoints || {}).length, Built: runpath.generated, File: 'data/kb/runpath.json' },
    body: [
      { type: 'heading', text: 'Target pace per segment' },
      { type: 'table', columns: ['Segment', 'From', 'To', ...rk.map(k => label[k] || k), 'Target', 'Cumulative', 'Why'], fmt: [null, null, null, ...rk.map(() => 'time'), 'time', 'time', null],
        rows: segs.map(sg => [sg.seg, sg.from, sg.to, ...rk.map(k => (sg.runs?.[k]?.dur != null ? +sg.runs[k].dur.toFixed(2) : '')), tgt[sg.seg]?.target ?? '', tgt[sg.seg]?.cum ?? '', tgt[sg.seg]?.why || '']) },
      { type: 'chart', kind: 'bar', title: 'Segment time: target vs each record run', fmt: 'time', labels: segs.map(sg => sg.seg), series: [{ name: 'Target', values: segs.map(sg => tgt[sg.seg]?.target ?? NaN) }, ...rk.filter(k => k !== 'samf').map(k => ({ name: label[k] || k, values: segs.map(sg => sg.runs?.[k]?.dur ?? NaN) }))] },
      ...((runpath.top5_vs_samf || []).length ? [{ type: 'heading', text: 'Biggest saves against the follow-along route' }, { type: 'table', columns: ['#', 'Segment', 'What', 'Follow-along', 'Best', 'Save (s)', 'Clips'], fmt: ['num', null, null, 'time', 'time', 'num', null],
        rows: runpath.top5_vs_samf.map(t => [t.rank, t.seg, t.what, t.samf, t.best, t.save, (t.clips || []).map(([v, a, , l]) => `[▶ ${fmtClock(a)}](${ytUrl(v, a)}) ${L('video:' + v, l)}`).join(' · ')]) }] : []),
      ...((runpath.nanobit_pinned_saves || []).length ? [{ type: 'heading', text: "Nanobit's own notes on his 7:01" }, ...runpath.nanobit_pinned_saves.map(n => ({ type: 'quote', text: n.note + (n.est_s ? ` (≈${n.est_s} s)` : ''), author: `Nanobit · ${n.seg}`, url: n.video_ts ? ytUrl('doVQ9Ph256g', vt(n.video_ts)) : null, t: n.video_ts ? vt(n.video_ts) : null, source: 'video:doVQ9Ph256g' }))] : []),
      ...((runpath.patched || []).length ? [{ type: 'heading', text: 'Patched since the records' }, { type: 'list', items: runpath.patched }] : []),
      ...(md.length ? [{ type: 'heading', text: 'Write-up (docs/runpath.md)' }, ...md] : []),
    ],
    links: [...rk.map(runId), ...Object.keys(runpath.new_sources || {}).map(v => 'video:' + v)],
    sources: Object.values(runpath.videos || {}).map(v => ytUrl(v)), updated: runpath.generated,
  });
  for (const v of Object.keys(runpath.new_sources || {})) page('video:' + v, 'video', v, { summary: runpath.new_sources[v], sources: [ytUrl(v)] });
}

// ------------------------------------------------------------------ builds (data/kb/builds.json + docs/builds/*.md)
const builds = await readJson(P('data/kb/builds.json'));
const buildMd = async id => { try { const b = mdBlocks(await readFile(P('docs/builds', id + '.md'), 'utf8')); const i = b.findIndex(x => x.type === 'heading' && x.level === 1); if (i >= 0) b.splice(i, 1); return b; } catch { return []; } };
for (const b of builds?.builds || []) {
  const srcs = [].concat(b.sources || []).map(x => (typeof x === 'string' ? x : x?.url)).filter(u => u && /^https?:/.test(u));
  const exp = b.expectedTime;
  page('build:' + b.id, 'build', b.name || b.id, {
    summary: b.for || '',
    props: { Patch: b.patch || '—', Status: b.status || '—', ...(exp != null ? { 'Expected time': typeof exp === 'number' ? fmtRun(exp) : typeof exp === 'object' ? Object.entries(exp).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k}: ${typeof v === 'number' && v > 60 ? fmtRun(v) : v}`).join(' · ').slice(0, 140) : exp } : {}), File: `docs/builds/${b.id}.md` },
    body: await buildMd(b.id), sources: srcs, updated: builds.updated,
  });
}
if (builds?.howToGetReqs) page('build:how-to-get-requirements', 'build', 'How to get every requirement', { summary: 'Where each skill level, spell, item and quest the builds need comes from.', body: await buildMd('how-to-get-requirements'), props: { File: 'docs/builds/how-to-get-requirements.md' }, updated: builds.updated });

// ------------------------------------------------------------------ term index (for transcripts, mentions)
const termMap = new Map();     // lower term -> Set(ids)
for (const p of pages.values()) for (const t of new Set(p.terms)) {
  const k = String(t).toLowerCase().trim();
  if (k.length < 4) continue;
  if (!termMap.has(k)) termMap.set(k, new Set());
  termMap.get(k).add(p.id);
}
// One page per term where possible: a wiki entry wins over a requirement of the same name.
for (const ids of termMap.values()) if ([...ids].some(i => i.startsWith('wiki:'))) for (const i of [...ids]) if (i.startsWith('req:')) ids.delete(i);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = new RegExp(`(?<![\\p{L}\\p{N}])(${[...termMap.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\p{L}\\p{N}]|\\.\\p{N})`, 'giu');
function termsIn(text) {
  const ids = new Set();
  if (!text) return ids;
  for (const m of String(text).matchAll(termRe)) for (const id of termMap.get(m[1].toLowerCase()) || []) ids.add(id);
  return ids;
}

// ------------------------------------------------------------------ speedrun.com ingest (runs, comments, users, rules)
for (const r of srRaw.runs || []) {
  const id = srcToKey[r.id] ? 'run:' + srcToKey[r.id] : 'run:src-' + r.id;
  const ids = (r.players || []).map(n => person(n));
  const vid = (r.videos || []).map(u => (String(u).match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1]).find(Boolean);
  const fresh = !has(id);
  const quotes = [
    ...(r.comment ? [{ type: 'quote', text: r.comment, author: `${(r.players || []).join(' & ')} (run comment)`, url: r.url }] : []),
    ...(r.examinerNote ? [{ type: 'quote', text: r.examinerNote, author: `${r.examinerName || 'Moderator'} (examiner)`, url: r.url }] : []),
    ...(r.comments || []).map(c => ({ type: 'quote', text: c.text, author: c.author, url: r.url })),
  ];
  page(id, 'run', `${(r.players || []).join(' & ')} ${fmtRun(r.time)}`, {
    summary: fresh ? `${(r.players || []).join(' & ')} — ${fmtRun(r.time)} (${r.bracket}), ${r.status} on speedrun.com.` : '',
    props: { ...(fresh ? { Runner: ids.map((p, j) => L(p, r.players[j])).join(', '), Time: fmtRun(r.time), Date: r.date, Bracket: r.bracket, 'speedrun.com': `[${r.id}](${r.url})` } : {}), Status: r.status, ...(r.examinerName ? { Examiner: r.examinerName } : {}), ...(r.verifiedAt ? { Verified: r.verifiedAt.slice(0, 10) } : {}), ...(vid && fresh ? { Video: L('video:' + vid) } : {}) },
    body: quotes.length ? [{ type: 'heading', text: 'On speedrun.com' }, ...quotes] : [],
    links: [...ids, 'source:speedrun-com', vid ? 'video:' + vid : null].filter(Boolean), sources: [r.url, ...(r.videos || [])], updated: r.date,
  });
  if (vid) page('video:' + vid, 'video', vid, { sources: [ytUrl(vid)] });
  for (const q of quotes) for (const t of termsIn(q.text)) if (t !== id) addMoment(t, { ...q, source: id, kind: 'comment' });
  if (fresh) addDay(r.date, { kind: 'run', text: `${(r.players || []).join(' & ')} ${fmtRun(r.time)} (${r.status}, ${r.bracket})`, id, url: r.url });
}
for (const u of Object.values(srUsers || {})) {
  if (!u || !u.name || !peopleRuns.has(slug(u.name))) continue;
  const id = person(u.name);
  page(id, 'runner', u.name, { props: { ...(u.country ? { Country: u.country.toUpperCase() } : {}), ...(u.twitch ? { Twitch: `[${u.twitch.replace(/^https?:\/\/(www\.)?/, '')}](${u.twitch})` } : {}), ...(u.youtube ? { YouTube: `[channel](${u.youtube})` } : {}), 'speedrun.com': `[profile](https://www.speedrun.com/users/${encodeURIComponent(u.name)})` }, sources: [u.twitch, u.youtube] });
}
if (srRules) {
  const cats = (srRules.categories || []).filter(c => c && c.rules);
  page('wiki:speedrun-rules', 'wiki', 'Raid category rules', {
    body: [
      ...(srRules.game?.rules ? [{ type: 'heading', text: 'Game rules (speedrun.com, live copy)' }, ...mdBlocks(srRules.game.rules)] : []),
      ...cats.flatMap(c => [{ type: 'heading', text: `Category: ${c.name}` }, ...mdBlocks(c.rules)]),
      ...((srRules.moderators || []).length ? [{ type: 'paragraph', text: 'Moderators: ' + srRules.moderators.map(m => (typeof m === 'string' ? m : m.name)).filter(Boolean).join(', ') }] : []),
    ],
    sources: [RULES.link], updated: srRules.fetchedAt,
  });
}

// ------------------------------------------------------------------ blog posts (content/blog/posts/*.md)
function frontMatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return [{}, md];
  const fm = {}; let key = null;
  const unq = v => v.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1').replace(/''/g, "'");
  for (const l of m[1].split(/\r?\n/)) {
    let x;
    if ((x = l.match(/^([\w-]+):\s*(.*)$/))) { key = x[1]; fm[key] = x[2].trim() === '' ? [] : unq(x[2]); }
    else if ((x = l.match(/^\s*-\s+(.*)$/)) && key) { if (!Array.isArray(fm[key])) fm[key] = []; fm[key].push(unq(x[1])); }
  }
  return [fm, md.slice(m[0].length)];
}
const posts = [];
for (const f of (await walk(P('content/blog/posts'))).filter(f => extname(f) === '.md').sort()) {
  const [fm, md] = frontMatter(await readFile(f, 'utf8'));
  posts.push({ f, fm, md, sl: fm.slug || basename(f, '.md').replace(/^\d+-/, '') });
}
const postSlugs = new Set(posts.map(p => p.sl));
for (const { f, fm, md, sl } of posts) {
  // internal blog links (/slug/) become page links
  const text = md.replace(/\]\(\/([\w-]+)\/?\)/g, (all, x) => (postSlugs.has(x) ? `](#/kb?p=post%3A${x})` : all));
  const body = mdBlocks(text);
  const counts = new Map();
  for (const b of body) for (const t of (b.type === 'table' ? b.rows.flat() : b.type === 'list' ? b.items : [b.text])) for (const id of termsIn(String(t ?? '').replace(/\*/g, ''))) counts.set(id, (counts.get(id) || 0) + 1);
  const about = [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
  const st = await stat(f);
  page('post:' + sl, 'post', fm.title || sl, {
    summary: fm.excerpt || '',
    props: { Series: fm.pillar || '—', Order: fm.series_order != null ? +fm.series_order : '—', Status: fm.status || 'published', Author: fm.author || '—', ...(fm.canonical ? { Canonical: `[${fm.canonical.replace(/^https?:\/\//, '')}](${fm.canonical})` } : {}), ...(about.length ? { About: about.slice(0, 5).map(id => L(id)).join(', ') } : {}), File: `content/blog/posts/${basename(f)}` },
    body, links: [...about, ...[fm.prev, fm.next].filter(x => typeof x === 'string').map(x => 'post:' + x.replace(/\//g, ''))],
    sources: [fm.canonical], updated: st.mtime.toISOString(),
  });
  for (const id of about.slice(0, 6)) { const t = pages.get(id); if (t) (t._posts ||= []).push('post:' + sl); }
}
for (const p of pages.values()) if (p._posts) { p.body.push({ type: 'heading', text: 'On the blog' }, { type: 'list', items: p._posts.map(id => L(id)) }); delete p._posts; }

// ------------------------------------------------------------------ raw ingest: transcripts, comments, chat, threads
// Formats are read loosely: any JSON/JSONL document with an id + title and arrays of
// {t|start|offset, text} (transcript/captions/segments/chat/messages) or {author, text} (comments).
const RAW = P('data/kb/raw');
const twChannels = await readJson(join(RAW, 'twitch', 'channels.json'), null);
for (const c of twChannels?.channels || []) {
  const name = c.runner || c.displayName || c.login;
  if (!name) continue;
  const id = person(name);
  page(id, null, name, { props: { Twitch: `[${c.login}](https://www.twitch.tv/${c.login})`, 'Twitch VODs': c.vodCount ?? '—', 'Dragonwilds VODs': (c.dragonwildsVods || []).length }, links: (c.dragonwildsVods || []).map(v => 'stream:' + v), sources: [`https://www.twitch.tv/${c.login}`] });
}
const rawFiles = (await walk(RAW)).filter(f => /\.(json|jsonl)$/.test(f) && !/ingest-log/.test(f) && !/^_|^channels\.json$/.test(basename(f)) && !/^[\\/]speedrun[\\/]/.test(f.slice(RAW.length)));
const tOf = x => { const v = x.t ?? x.start ?? x.offset ?? x.time ?? x.ts ?? x.seconds ?? x.content_offset_seconds; if (typeof v === 'string' && v.includes(':')) return v.split(':').reduce((a, b) => a * 60 + +b, 0); const n = num(v); return isFinite(n) ? (n > 1e6 ? n / 1000 : n) : null; };
const textOf = x => (typeof x === 'string' ? x : x.text ?? x.body ?? x.message ?? x.content ?? x.comment ?? x.selftext ?? (x.message && x.message.body) ?? '');
const authorOf = x => x.author ?? x.user ?? x.username ?? x.name ?? x.commenter?.display_name ?? x.authorName ?? '';
const rawStats = { docs: 0, lines: 0, comments: 0, chat: 0 };

function rawDocs(j, src) {
  if (Array.isArray(j)) return j.flatMap(x => rawDocs(x, src));
  if (!j || typeof j !== 'object') return [];
  for (const k of ['videos', 'items', 'threads', 'posts', 'runs', 'docs', 'data']) if (Array.isArray(j[k]) && j[k].some(x => x && typeof x === 'object' && (x.id || x.videoId || x.title))) return j[k].flatMap(x => rawDocs({ ...x, _src: src }, src));
  return [j];
}
const rawGroups = {};
for (const f of rawFiles) {
  const src = (f.slice(RAW.length + 1).split(/[\\/]/)[0] || 'misc').toLowerCase();
  if (src.endsWith('.json') || src.endsWith('.jsonl')) continue;
  let docs = [];
  if (f.endsWith('.jsonl')) {
    const rows = await readJsonl(f);
    const isLines = rows.length && rows.every(r => typeof textOf(r) === 'string' && !r.title && tOf(r) != null);
    docs = isLines ? [{ id: basename(f).replace(/\.jsonl$/, ''), lines: rows }] : rows.flatMap(r => rawDocs(r, src));
  } else docs = rawDocs(await readJson(f), src);
  for (const d of docs) (rawGroups[src] ||= []).push({ d, f });
}
for (const [src, list] of Object.entries(rawGroups)) for (const { d, f } of list) {
  rawStats.docs++;
  const rawId = String(d.videoId ?? d.vid ?? d.id ?? d.key ?? basename(f).replace(/\.\w+$/, '')).replace(/^yt:/, '');
  const isYt = src.startsWith('youtube') || /^[\w-]{11}$/.test(rawId) && /youtu/.test(d.url || 'youtu');
  const isTw = src.startsWith('twitch');
  const isRd = src.startsWith('reddit');
  const isSr = src.startsWith('speedrun');
  let id, type, url = d.url || d.permalink || d.link || d.weblink || null;
  if (url && isRd && url.startsWith('/')) url = 'https://www.reddit.com' + url;
  if (isSr) { id = srcToKey[rawId] ? 'run:' + srcToKey[rawId] : has('run:src-' + rawId) ? 'run:src-' + rawId : 'raw:speedrun-' + slug(rawId); type = id.startsWith('run:') ? 'run' : 'thread'; }
  else if (isYt) { id = 'video:' + rawId; type = 'video'; url ||= ytUrl(rawId); }
  else if (isTw) { id = 'stream:' + slug(rawId); type = 'stream'; url ||= /^\d+$/.test(rawId) ? twUrl(rawId) : null; }
  else if (isRd) { id = 'thread:' + slug(rawId); type = 'thread'; }
  else { id = `raw:${slug(src)}-${slug(rawId)}`; type = 'thread'; }
  const at = t => (t == null ? url : isYt ? ytUrl(rawId, t) : isTw && /^\d+$/.test(rawId) ? twUrl(rawId, t) : url);
  const lines = (d.transcript || d.captions || d.segments || d.lines || (Array.isArray(d.chat) ? null : d.subtitles) || []);
  const chat = d.chat || d.messages || d.chatMessages || [];
  const comments = d.comments || d.replies || [];
  const flatComments = []; (function fc(cs, depth) { for (const c of cs || []) { if (!c || typeof c !== 'object') continue; flatComments.push({ ...c, depth }); fc(c.replies || c.children || [], depth + 1); } })(Array.isArray(comments) ? comments : [], 0);
  rawStats.lines += lines.length; rawStats.chat += chat.length; rawStats.comments += flatComments.length;
  const who = d.author || d.channel || d.uploader || d.user || d.subreddit && `r/${String(d.subreddit).replace(/^r\//, '')}`;
  const known = pages.get(isYt ? 'video:' + rawId : '')?.props.Channel;
  const aid = known ? (known.match(/\[\[([^\]|]+)/) || [])[1] : who && !isRd && typeof who === 'string' ? person(who) : null;
  const counts = new Map(), body = [], quotesHere = [];
  const scan = (arr, kind) => {
    for (const x of arr) {
      const text = textOf(x); if (!text || typeof text !== 'string') continue;
      const t = tOf(x), hits = termsIn(text);
      for (const target of hits) {
        if (target === id) continue;
        counts.set(target, (counts.get(target) || 0) + 1);
        const q = { type: 'quote', text: trunc(text, 280), author: authorOf(x) || (kind === 'transcript' ? (typeof who === 'string' ? who : '') : ''), source: id, url: at(t), t, kind };
        addMoment(target, q);
        if (quotesHere.length < 60) quotesHere.push({ ...q, text: `${L(target)} · ${trunc(text, 240)}` });
      }
    }
  };
  scan(lines, 'transcript'); scan(chat, 'chat'); scan(flatComments, 'comment');
  const top = [...counts].sort((a, b) => b[1] - a[1]);
  const typeLabel = { video: 'video', stream: 'stream', thread: 'thread', run: 'run' }[type];
  const summary = [
    lines.length ? `${lines.length} transcript lines` : '', chat.length ? `${chat.length} chat messages` : '', flatComments.length ? `${flatComments.length} comments` : '',
  ].filter(Boolean).join(', ');
  body.push({ type: 'heading', text: `From the ${src} ingest` });
  body.push({ type: 'paragraph', text: `${summary || 'No text'}.${top.length ? ' Talks most about ' + top.slice(0, 8).map(([k, n]) => `${L(k)} (${n})`).join(', ') + '.' : ''}` });
  if (d.selftext || d.body && typeof d.body === 'string') body.push({ type: 'paragraph', text: trunc(d.selftext || d.body, 1200) });
  if (d.comment && typeof d.comment === 'string') body.push({ type: 'quote', text: d.comment, author: who || '', url });
  if (quotesHere.length) body.push({ type: 'heading', text: 'Moments that mention route pages' }, ...quotesHere);
  if (flatComments.length) {
    const best = [...flatComments].sort((a, b) => (num(b.likes ?? b.score ?? b.ups ?? b.votes) || 0) - (num(a.likes ?? a.score ?? a.ups ?? a.votes) || 0)).slice(0, 8);
    body.push({ type: 'heading', text: 'Top comments' }, ...best.map(c => ({ type: 'quote', text: trunc(textOf(c), 400), author: String(authorOf(c) || ''), url: c.url || c.permalink && (String(c.permalink).startsWith('/') ? 'https://www.reddit.com' + c.permalink : c.permalink) || url })));
  }
  if (lines.length > 20) {
    const ts = lines.map(tOf).filter(x => x != null);
    if (ts.length > 20) body.push({ type: 'chart', kind: 'histogram', title: 'Where route terms come up (video time, s)', values: lines.filter(x => termsIn(textOf(x)).size).map(tOf).filter(x => x != null), bins: 24, fmt: 'clock' });
  }
  if (chat.length > 20) body.push({ type: 'chart', kind: 'histogram', title: 'Chat activity over the stream (s)', values: chat.map(tOf).filter(x => x != null), bins: 30, fmt: 'clock' });
  page(id, type, d.title || d.name || rawId, {
    summary: d.description && type !== 'video' ? trunc(d.description, 300) : `Ingested ${typeLabel}: ${summary || 'metadata only'}.`,
    props: { ...(aid ? { [isTw ? 'Channel' : 'Author']: L(aid, who) } : who ? { Author: who } : {}), ...(d.date || d.published || d.created || d.created_utc || d.publishedAt ? { Date: dateOf(d.date || d.published || d.created || d.created_utc || d.publishedAt) } : {}), ...(d.score != null ? { Score: d.score } : {}), ...(url ? { Link: `[${src}](${url})` } : {}) },
    body, links: [...top.map(([k]) => k), aid, siteOf(url || '') || null].filter(Boolean), sources: [url],
    updated: d.date || d.published || d.created || d.publishedAt || dateOf(d.created_utc),
  });
}
// Moments land as backlinks with timestamps on the page they mention.
for (const [target, qs] of moments) {
  if (!has(target)) continue;
  const bySrc = new Map();
  for (const q of qs) { const n = bySrc.get(q.source) || 0; if (n < 4) { bySrc.set(q.source, n + 1); } else continue; (bySrc.list ||= []).push(q); }
  const pick = (bySrc.list || []).slice(0, 30).map(({ kind, ...q }) => ({ ...q, text: `${q.text}` }));
  if (pick.length) pages.get(target).body.push({ type: 'heading', text: `Mentioned in transcripts, chat and comments (${qs.length})` }, ...pick);
}

// ------------------------------------------------------------------ runners + channels: tables and charts
const allRuns = [...pages.values()].filter(p => p.type === 'run');
for (const p of pages.values()) if (p.type === 'runner' || p.type === 'channel') {
  const runs = allRuns.filter(r => r.links.includes(p.id));
  const vids = [...pages.values()].filter(v => (v.type === 'video' || v.type === 'stream') && v.links.includes(p.id));
  const skips = [...pages.values()].filter(s => (s.type === 'skip' || s.type === 'technique') && s.links.includes(p.id));
  const times = runs.map(r => ({ r, t: RUNS.find(x => 'run:' + x.key === r.id)?.time ?? srcRuns.find(i => r.id.endsWith(i.key.replace('src:', '')))?.time, d: r.props.Date })).filter(x => x.t);
  const bestRun = times.sort((a, b) => a.t - b.t)[0];
  p.summary ||= p.type === 'runner' ? `${p.title}: ${runs.length} run${runs.length === 1 ? '' : 's'} on file${bestRun ? `, best ${fmtRun(bestRun.t)}` : ''}${vids.length ? `, ${vids.length} video${vids.length === 1 ? '' : 's'}` : ''}.` : `${p.title}: ${vids.length} video${vids.length === 1 ? '' : 's'}${skips.length ? `, credited on ${skips.length} skip${skips.length === 1 ? '' : 's'}` : ''}.`;
  Object.assign(p.props, { Runs: runs.length, Videos: vids.length, ...(bestRun ? { Best: fmtRun(bestRun.t) } : {}), ...(skips.length ? { Credited: skips.length } : {}) });
  if (runs.length) p.body.unshift({ type: 'heading', text: 'Runs' }, { type: 'table', columns: ['Run', 'Time', 'Date'], fmt: [null, 'time', null], rows: times.map(x => [L(x.r.id, x.r.title), x.t, x.d || '']) });
  if (times.length > 1) p.body.push({ type: 'chart', kind: 'line', title: `${p.title} — run time by date`, fmt: 'time', xType: 'date', series: [{ name: p.title, points: times.filter(x => x.d).sort((a, b) => a.d.localeCompare(b.d)).map(x => [x.d, x.t]) }] });
  if (vids.length) p.body.push({ type: 'heading', text: 'Videos' }, { type: 'list', items: vids.map(v => `${L(v.id, v.title)}${v.props.Published ? ' — ' + v.props.Published : ''}`) });
  if (skips.length) p.body.push({ type: 'heading', text: 'Credited on' }, { type: 'list', items: skips.map(s => L(s.id, s.title)) });
  p.links.push(...runs.map(r => r.id));
}
for (const p of pages.values()) if (p.type === 'video' && p.title === p.id.slice(6)) { p.title = `YouTube video ${p.title}`; p.summary ||= 'Video linked from a run or the route; not in the library yet.'; p.props.Watch ||= `[YouTube](${ytUrl(p.id.slice(6))})`; }

// ------------------------------------------------------------------ daily notes
for (const e of await readJsonl(P('data/sources-log.jsonl'))) {
  const id = e.kind === 'run' ? (srcToKey[e.key?.replace('src:', '')] ? 'run:' + srcToKey[e.key.replace('src:', '')] : 'run:src-' + e.key?.replace('src:', '')) : 'video:' + String(e.key).replace(/^yt:/, '');
  addDay(e.at, { kind: e.event === 'new' ? `new ${e.kind}` : `${e.event} ${e.kind}`, text: `${e.title}${e.author ? ' — ' + e.author : ''}${e.status && e.kind === 'run' ? ` (${e.status})` : ''}${e.changes ? ' · ' + JSON.stringify(e.changes) : ''}`, id: has(id) ? id : undefined, url: e.url, at: e.at });
}
for (const e of await readJsonl(P('data/kb/raw/ingest-log.jsonl'))) {
  const text = e.text || e.message || e.title || [e.source, e.event || e.type, e.id || e.key, e.count != null ? `${e.count} items` : ''].filter(Boolean).join(' ');
  const rid = e.videoId ? 'video:' + e.videoId : e.page || null;
  addDay(e.at || e.date || e.time, { kind: `ingest ${e.source || ''}`.trim(), text: trunc(text, 200), id: rid && has(rid) ? rid : undefined, url: e.url, at: e.at });
}
for (const post of notes.posts) addDay(post.date, { kind: post.patch ? 'patch' : 'news', text: post.title, id: post.version ? 'patch:' + post.version : 'news:' + post.id, url: post.url });
for (const x of PATCHES) if (!postByVersion[x.v]) addDay(x.date, { kind: 'patch', text: `${x.v}: ${trunc(x.text, 160)}`, id: 'patch:' + x.v });
for (const r of RUNS) addDay(r.date, { kind: 'run', text: `${r.label} recorded`, id: 'run:' + r.key });
for (const i of srcRuns) if (!srcToKey[i.key.replace('src:', '')]) addDay(i.date, { kind: 'run', text: `${i.title} (${i.status})`, id: 'run:src-' + i.key.replace('src:', ''), url: i.url });
for (const v of VIDEOS) addDay(v.date, { kind: 'video', text: `${v.title} — ${v.author}`, id: 'video:' + v.id });
for (const p of pages.values()) if (p.type === 'math' || p.type === 'analysis') addDay(p.updated, { kind: p.type, text: p.title, id: p.id });
try {
  const log = execFileSync('git', ['log', '--date=iso-strict', '--format=%x1e%H%x1f%ad%x1f%s', '--name-only', '-n', '400'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  for (const chunk of log.split('\x1e').filter(Boolean)) {
    const [head, ...files] = chunk.trim().split('\n');
    const [hash, ad, subj] = head.split('\x1f');
    if (/^data: patch notes \+ sources/.test(subj)) continue;          // the hourly bot; its content is logged above
    addDay(ad, { kind: 'commit', text: subj, url: `https://github.com/DrThomasAger/dragonwilds-speedrun/commit/${hash}`, at: ad, files: files.filter(Boolean).length });
  }
} catch { /* not a git checkout */ }
const dayList = [...days].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({ date, items }));
for (const { date, items } of dayList) {
  const kinds = {}; for (const i of items) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  page('day:' + date, 'day', date, {
    summary: Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(' · '),
    body: [{ type: 'list', items: items.map(i => `${i.kind}: ${i.id ? L(i.id, i.text) : i.url ? `[${i.text.replace(/[[\]]/g, '')}](${i.url})` : i.text}`) }],
    updated: date,
  });
}

// ------------------------------------------------------------------ home
const counts = {};
for (const p of pages.values()) counts[p.type] = (counts[p.type] || 0) + 1;
page('kb:home', 'index', 'Raid knowledge base', {
  summary: `Everything the lab knows about the Scorned Wilderness raid, as linked pages: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${n === 1 ? k : { index: 'hubs', analysis: 'analyses', news: 'news posts', day: 'daily notes', match: 'maths' }[k] || k + 's'}`).join(', ')}. Rebuilt hourly from every source.`,
  props: { 'Record to beat': `${fmtRun(RECORD.time)} · ${L('run:' + RECORD.key, RECORD.runner)}`, 'Target': runpath?.target?.total ? `${fmtRun(runpath.target.total)} · ${L('kb:runpath', 'optimal path')}` : fmtRun(TARGET_TIME), 'Route verified on': L('patch:1.0.1.2', '1.0.1.2'), 'Leaderboard snapshot': SRC_SNAPSHOT.at.slice(0, 10), Built: now.slice(0, 16).replace('T', ' ') + ' UTC' },
  body: [
    { type: 'heading', text: 'Start here' },
    { type: 'list', items: [L('kb:splits'), L('kb:patches'), ...(runpath ? [L('kb:runpath')] : []), ...[...pages.values()].filter(p => p.type === 'build').map(p => L(p.id)), L('run:' + RECORD.key, 'The record run'), ...SPLITS.map((s, k) => L(`split:${k + 1}`, `${k + 1}. ${s.name}`))] },
    { type: 'heading', text: 'Where #1 is won' },
    { type: 'list', items: OPPORTUNITIES.map(o => `**${o.title}** — ${o.text}${o.src?.length ? ' (' + o.src.map(k => BY_KEY[k] ? L('video:' + BY_KEY[k].id, BY_KEY[k].author) : null).filter(Boolean).join(', ') + ')' : ''}`) },
    { type: 'heading', text: 'Gear' }, { type: 'table', columns: ['Item', 'Why'], rows: GEAR },
    { type: 'chart', kind: 'bar', title: 'Pages by type', labels: Object.keys(counts), series: [{ name: 'Pages', values: Object.values(counts) }] },
    ...(mathFiles.length ? [{ type: 'heading', text: 'Maths' }, { type: 'list', items: [...pages.values()].filter(p => p.type === 'math').map(p => L(p.id)) }] : []),
    ...(analysisFiles.length ? [{ type: 'heading', text: 'Analysis' }, { type: 'list', items: [...pages.values()].filter(p => p.type === 'analysis').map(p => L(p.id)) }] : []),
  ],
  links: ['kb:splits', 'kb:patches'], updated: today,
});

// ------------------------------------------------------------------ links, backlinks, mentions
const LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const blockTexts = b => {
  if (b.type === 'table') return b.rows.map(r => r.map(c => String(c ?? '')).join(' · '));
  if (b.type === 'list') return b.items.map(String);
  if (b.type === 'chart') return [];
  return [String(b.text || '')];
};
const plain = s => String(s).replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, id, lab) => lab || pages.get(id)?.title || id).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
for (const p of pages.values()) {
  const ids = new Set(p.links);
  for (const v of Object.values(p.props)) for (const m of String(v).matchAll(LINK)) ids.add(m[1]);
  for (const b of p.body) for (const t of blockTexts(b)) for (const m of t.matchAll(LINK)) ids.add(m[1]);
  ids.delete(p.id);
  p.links = [...ids].filter(has);
  p.sources = [...new Set(p.sources.filter(Boolean))];
  p.updated ||= today;
}
const back = new Map(), ment = new Map();
for (const p of pages.values()) {
  const ctx = new Map();
  const note = (id, s) => { if (!ctx.has(id)) ctx.set(id, []); const a = ctx.get(id); if (s && a.length < 3) a.push(trunc(plain(s), 220)); };
  for (const [k, v] of Object.entries(p.props)) for (const m of String(v).matchAll(LINK)) note(m[1], `${k}: ${v}`);
  for (const b of p.body) for (const t of blockTexts(b)) for (const m of t.matchAll(LINK)) note(m[1], t);
  for (const id of p.links) { note(id); if (!back.has(id)) back.set(id, []); back.get(id).push({ id: p.id, ctx: ctx.get(id) || [] }); }
  // unlinked mentions: this page's text names another page it does not link to
  if (p.type === 'day') continue;
  const texts = [p.summary, ...p.body.flatMap(blockTexts)].map(plain);
  for (const t of texts) for (const id of termsIn(t)) {
    if (id === p.id || p.links.includes(id)) continue;
    if (!ment.has(id)) ment.set(id, new Map());
    const m = ment.get(id); if (!m.has(p.id)) m.set(p.id, trunc(t, 220));
  }
}
const order = { index: 0, split: 1, run: 2, skip: 3, technique: 4, requirement: 5, wiki: 6, runner: 7, channel: 8, video: 9, patch: 10, analysis: 11, math: 12 };
for (const p of pages.values()) {
  p.backlinks = (back.get(p.id) || []).sort((a, b) => (order[pages.get(a.id).type] ?? 20) - (order[pages.get(b.id).type] ?? 20));
  p.mentions = [...(ment.get(p.id) || [])].slice(0, 40).map(([id, ctx]) => ({ id, ctx }));
  delete p.terms;
}

// ------------------------------------------------------------------ write
const list = [...pages.values()].sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
const finalCounts = {}; for (const p of list) finalCounts[p.type] = (finalCounts[p.type] || 0) + 1;
const edges = [];
for (const p of list) for (const l of p.links) edges.push([p.id, l]);
const deg = {}; for (const [a, b] of edges) { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; }
await mkdir(P('data/kb'), { recursive: true });
await writeFile(P('data/kb/pages.json'), JSON.stringify({ generated: now, counts: finalCounts, raw: rawStats, pages: list }));
await writeFile(P('data/kb/graph.json'), JSON.stringify({ generated: now, nodes: list.map(p => ({ id: p.id, title: p.title, type: p.type, n: deg[p.id] || 0 })), edges }));
await writeFile(P('data/kb/daily.json'), JSON.stringify({ generated: now, days: dayList }));
console.log(`kb: ${list.length} pages, ${edges.length} links, ${dayList.length} days · ${Object.entries(finalCounts).map(([k, n]) => `${k} ${n}`).join(', ')} · raw ${rawStats.docs} docs / ${rawStats.lines} lines / ${rawStats.comments} comments / ${rawStats.chat} chat`);
