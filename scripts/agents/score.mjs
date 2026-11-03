// Agent Observatory scorer. Reads data/kb/agents/index.json + conversations/*.json and writes
//   data/kb/agents/metrics.json  (per conversation, per day, per month, per source, top corrections)
//   data/kb/agents/requests.json (every human request with a status)
// Method: docs/agents/METRICS.md. Pure rules + lexicons (SMILE tier 1: deterministic code).
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CONV_DIR, readJSON, writeJSON } from './lib.mjs';

const index = readJSON(path.join(OUT, 'index.json')).conversations;

// ------------------------------------------------------------------ lexicons
const norm = s => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const DONT = "(?:don'?t|do not|dont|never|stop|quit)";
export const CORRECTION = {
  'told-you-already': /\b(i (already |just )?(told|said|asked|mentioned|explained)( (you|u))?\b|as i (said|told|asked|mentioned)|i'?ve (already )?(told|said|asked)|how many times|for the (last|\w+) time|i keep (telling|saying|asking)|again\?|told u|said it before|repeat(ing)? myself)/i,
  'prohibition': new RegExp(`\\b(${DONT} (ever )?(ask|suggest|tell|give|use|make|delete|write|touch|say|do|invent|change|add|remove|put|forget|assume|guess|mention|talk|show|open|create|call|lie|pretend|skip|ignore|summari[sz]e|explain)|never again|don'?t ever|do not ever)\\b`, 'i'),
  'stop': /(^|[.!?]\s*|\b(please|just|pls|so|now|bro|dude)\s+)(stop|quit|enough|cut it out)\b(?! (the|this) (server|process|recording|timer|service|bot|script|task|run))/i,
  'why-did-you': /\bwhy (did|didn'?t|would|wouldn'?t|are|aren'?t|do|don'?t|have|haven'?t|is|isn'?t|was|wasn'?t|can'?t|the fuck|tf|tho)\b ?(you|u|it|this|that|there|the|not)?/i,
  'wrong-output': /\b(not what i (asked|wanted|said|meant)|that'?s not (it|right|what i)|that'?s wrong|is wrong|are wrong|wrong (one|file|place|thing|answer|way)|incorrect|you misunderstood|misread|i meant\b|i didn'?t (ask|say|want)|thats not|not correct|nonsense|makes no sense)/i,
  'failure-report': /\b(still (not|doesn'?t|isn'?t|broken|fails?|failing|the same|wrong|there|happening|no|nothing|can'?t)|doesn'?t work|didn'?t work|not working|isn'?t working|is broken|it'?s broken|its broken|it fails|nothing (happens|happened|changed)|same (error|problem|issue|thing)|can'?t see|cant see|i don'?t see|i dont see|not showing|doesn'?t show|didn'?t (change|load|open|run|happen)|crash(ed|es)?|error again|broke\b)/i,
  'not-followed': /\b((you|u) (didn'?t|did not|forgot|missed|ignored|skipped|haven'?t|keep|still haven'?t|never (did|listen))|you'?re not (listening|reading|following)|ur not|not listening|read (it|my|what i|the)\b.{0,30}\b(again|properly|fully|carefully)|follow (my|the) instructions|i said\b)/i,
  'unverified-claim': /\b(verify|verified|did you (test|check|verify|actually|even)|are you sure|have you (tested|checked|verified)|test it|prove it|headful|you said (it was|its|it'?s) (done|fixed|working)|it'?s not done|not (done|finished|complete)|you lied|lying)\b/i,
  'stop-asking-do-it': /\b((don'?t|dont|stop|never|no need to) (ask|asking)( me)?( to)?( confirm| for| permission| whether| if)?|just do it|do it yourself|you do it|i'?m not doing|dont make me|don'?t make me|stop with (this|the) advisor|advisor mode|stop suggesting|without asking|do it all|do everything)\b/i,
  'undo': /\b(undo|revert|roll ?back|put it back|bring (it )?back|restore (it|the))\b/i,
};
const INSULT = /\b(fuck\w*|fk\w*|fkin|fking|fcking|f\*+k\w*|shit\w*|wtf|stfu|idiot\w*|stupid|dumb\w*|retard\w*|moron\w*|useless|pathetic|garbage|crap|bullshit|motherfuck\w*|asshole|asss+|bitch\w*|damn|dammit|bloody hell|hate you|shut up|braindead|incompetent|lazy)\b/i;
const WARM = /(\b(thanks?|thank (you|u)|thx|tysm|ty|appreciate\w*|great|good job|well done|nice|love (it|this|that|you|u)|amazing|awesome|perfect|brilliant|beautiful|excellent|wonderful|fantastic|cool|yay|please|pls|plz|kind|bless\w*|sadhu|metta|congrat\w*|good (work|stuff|one|idea)|wow|haha+|lol|lovely|sweet|legend|nice one|gorgeous|superb|beloved|dear)\b|\(:|:\)|:D|\u{1F60A}|\u{1F64F}|❤|\u{1F496}|✨|\u{1F642}|\u{1F604})/iu;
const ACK = /^\s*(ok(ay)?|k|thanks?|thank you|ty|cool|great|nice|yes|yep|yeah|ya|y|sure|continue|go|go on|go ahead|proceed|carry on|perfect|good|done|lol|haha)[\s.!:)]*$/i;
const AI_REFUSAL = /\b(i can'?t (help|assist|do that|provide|comply)|i(?:'m| am) (unable|not able) to (help|assist|provide|comply)|i won'?t (be able to )?(help|do|provide)|as an ai( language model)?,? i (can'?t|cannot|don'?t)|i cannot (help|assist|provide|do|comply)|i must decline|i'?m sorry,? but i can'?t)\b/i;
const AI_CLAIM = /\b(done|completed?|fixed|works now|working now|all set|verified|shipped|deployed|resolved|implemented|is live|ready|finished|now (works|shows|loads))\b/i;
const AI_CONFIRM_ASK = /(would you like me to|do you want me to|should i\b|shall i\b|let me know if you'?d like|want me to\b|if you'?d like,? i can|would you prefer)/i;
const AI_WARM = /\b(happy to|glad|great (question|idea|point)|thank you|thanks for|you'?re right|good (call|catch|idea|point)|let'?s|together|sorry|apologi[sz]e|my mistake|i understand|appreciate)\b/i;
const CONFIRM_BAN = CORRECTION['stop-asking-do-it'];

// Themes for "most frequent corrections" (multi-label, counted per correction turn).
const THEMES = [
  ['Stop asking me to confirm; just do it (no advisor mode)', /\b((don'?t|dont|stop|never|no need to) (ask|asking)|confirm|just do it|do it yourself|you do it|advisor|permission|without asking|stop suggesting|i'?m not doing|dont make me|don'?t make me)\b/i],
  ['It still does not work / still broken', /\b(still|doesn'?t work|didn'?t work|not working|isn'?t working|broken|broke|fails?|failing|crash\w*|error|nothing (happens|happened|changed)|same (problem|issue|thing))\b/i],
  ['I cannot see it / it is not showing', /\b(can'?t see|cant see|don'?t see|dont see|not showing|not visible|where (is|are|the)|invisible|blank|nothing shows|no (image|video|box))\b/i],
  ['I already told you / repeating myself', /\b(i (already |just )?(told|said|asked|mentioned)|as i (said|told|asked)|how many times|again|told u|repeat|keep (telling|saying|asking))\b/i],
  ['Verify it yourself before claiming done (headful, test it)', /\b(verify|verified|test(ed)? it|headful|are you sure|did you (test|check|actually)|not (done|finished|complete)|claim|prove|lied|lying|check (it|yourself))\b/i],
  ['Do not suggest that / do not invent options', /\b(suggest\w*|invent\w*|made? up|make (stuff|things|shit) up|hallucinat\w*|fake|dumb shit|nonsense|options?)\b/i],
  ['Wrong thing / not what I asked (incl. the canned "your last code generation was not correct")', /\b(wrong|not what i|(?<!(that'?s|thats) wh?a?a?t )i meant|i didn'?t (ask|say|want)|misunderstood|misread|incorrect|not correct|not (it|right)|that'?s not|thats not)\b/i],
  ['Why did you do that?', /\bwhy (did|didn'?t|would|are|is|do|the fuck|tf)\b/i],
  ['Stop / cancel that', /(^|[.!?]\s*|\b(please|just|pls|so|now|bro|dude)\s+)(stop|quit|enough|cancel)\b/i],
  ['Do all of it fully, not partially (you removed detail / left things out)', /\b(all of (it|them)|fully|the whole (thing|file|doc\w*|text|code)|not partial\w*|partially|comprehensive\w*|every single|retain|you (only|just) (did|read|looked at|wrote)|removed (the )?detail|didn'?t elaborate|left (out|things out)|missing|incomplete|truncated|cut (it )?(off|short)|full (code|file|version))\b/i],
  ['Do not delete / undo that', /\b(delet\w*|remov\w*|undo|revert|roll ?back|put it back|restore)\b/i],
  ['Shorter / stop talking, less text', /\b(shorter|too long|less (talk|text|words)|concise|stop talking|minimal|brief|tl;?dr|wall of text|just (give|tell|show) me)\b/i],
  ['Search / research properly, use verified sources', /\b(search|research|look (it )?up|sources?|verified|official|wiki|speedrun\.com|google it)\b/i],
  ['Run it in the background / do not block me', /\b(background|in parallel|blocking|block me|async|in the meantime|keep me waiting|so slow|taking (so|too) long)\b/i],
  ['Do not touch the mouse / let me control', /\b(mouse|cursor|my (screen|control)|take (over|control)|ctrl ?\+? ?shift ?\+? ?esc)\b/i],
  ['Wrong location / never write to C:', /(\bc:\\|\bc:|\bc drive|wrong (folder|place|location|path|directory)|write to [a-z]:)/i],
  ['Never mention cost', /\b(cost|price|pricing|expensive|cheap|money|tokens? (cost|spend))\b/i],
];

const STOP = new Set('the a an and or but to of in on for with is are was were be been it this that these those i you u we they he she me my your our its at as by from so do does did not no yes if then than just can could would should will make sure also all any some get got have has had what which who how why when where there here into about out up down over again more most very really like want need please ok okay'.split(' '));
const words = s => (norm(s).toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter(w => !STOP.has(w));
function jaccard(a, b) {
  if (a.size < 4 || b.size < 4) return 0;
  let i = 0; for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
}
function scanText(text) {
  // Long turns are usually pasted material; only their opening is treated as the user's own voice.
  const t = norm(text);
  return t.length > 2000 ? t.slice(0, 300) : t.slice(0, 600);
}
function correctionCats(text) {
  const s = scanText(text);
  return Object.entries(CORRECTION).filter(([, re]) => re.test(s)).map(([k]) => k);
}
function themesOf(text) { const s = scanText(text); return THEMES.filter(([, re]) => re.test(s)).map(([k]) => k); }
function isShout(text) {
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const upper = (text.match(/[A-Z]/g) || []).length;
  return letters >= 12 && upper / letters >= 0.7;
}
function humanLabel(text) {
  const s = scanText(text);
  if (INSULT.test(s) || isShout(s) || /!!!|\?!\?|\?\?\?/.test(s)) return 'unwholesome';
  if (WARM.test(s)) return 'wholesome';
  return 'neutral';
}
const day = t => (t ? t.slice(0, 10) : null);
const clip = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
const r1 = x => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const coop = (w, u, n) => (n ? 50 + 50 * (w - u) / n : null);

// ------------------------------------------------------------------ pass 1: when was confirmation-seeking banned?
let confirmBanDate = null;
const convs = [];
for (const meta of index) {
  const c = readJSON(path.join(CONV_DIR, meta.file));
  c._file = meta.file;
  convs.push(c);
  if (c.document) continue;
  for (const t of c.turns) if (t.role === 'user' && CONFIRM_BAN.test(scanText(t.text)) && /confirm|ask/i.test(t.text) && t.t && (!confirmBanDate || t.t < confirmBanDate)) confirmBanDate = t.t;
}

// ------------------------------------------------------------------ pass 2: score
const requests = [];
const convScores = [];
const daily = new Map();
const D = d => {
  if (!daily.has(d)) daily.set(d, { date: d, conversations: new Set(), sources: new Set(), models: new Set(), projects: new Set(), tools: new Set(), agents: 0,
    userTurns: 0, aiTurns: 0, requests: 0, responded: 0, nonAdherent: 0, corrections: 0, completions: 0, failures: 0, interrupts: 0,
    h: { wholesome: 0, neutral: 0, unwholesome: 0 }, a: { wholesome: 0, neutral: 0, unwholesome: 0 }, words: [] });
  return daily.get(d);
};
const themeCounts = new Map();
const catCounts = {};
const childCount = {};
for (const c of convs) if (c.parent) childCount[c.parent] = (childCount[c.parent] || 0) + 1;

for (const c of convs) {
  if (c.document) continue;
  const turns = c.turns;
  const userOnly = !!c.userOnly;
  const humanRole = 'user';
  let seenAI = false;
  const userIdx = [];
  turns.forEach((t, i) => { if (t.role === humanRole) userIdx.push(i); });
  const S = { requests: 0, responded: 0, nonAdherent: 0, corrections: 0, completions: 0, failures: 0, interrupts: 0, repeats: 0,
    h: { wholesome: 0, neutral: 0, unwholesome: 0 }, a: { wholesome: 0, neutral: 0, unwholesome: 0 }, maxStreak: 0, cats: {} };
  let streak = 0;
  const prevReqs = [];
  const convReqs = [];
  // per-turn annotations
  const ann = turns.map(() => ({}));
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role === 'assistant' || t.role === 'tool') seenAI = true;
    if (t.role === 'system' && /^\[Request interrupted/.test(t.text)) {
      S.interrupts++; if (t.t) D(day(t.t)).interrupts++;
    }
    if (t.role !== humanRole) continue;
    if (t.name === 'queued') { S.interrupts++; if (t.t) D(day(t.t)).interrupts++; }
    const txt = norm(t.text);
    const isCmd = txt.startsWith('[CMD]');
    const label = humanLabel(txt);
    S.h[label]++; ann[i].label = label;
    let cats = (seenAI || (userOnly && userIdx[0] !== i)) && !isCmd ? correctionCats(txt) : [];
    const ws = new Set(words(txt));
    if (!isCmd && txt.length <= 600 && prevReqs.some(p => jaccard(p, ws) >= 0.6)) { cats = [...cats, 'repeat-request']; S.repeats++; }
    ann[i].cats = cats;
    if (cats.length) {
      S.corrections++; streak++; S.maxStreak = Math.max(S.maxStreak, streak);
      for (const k of cats) { S.cats[k] = (S.cats[k] || 0) + 1; catCounts[k] = (catCounts[k] || 0) + 1; }
      for (const th of themesOf(txt)) {
        if (!themeCounts.has(th)) themeCounts.set(th, { theme: th, count: 0, bySource: {}, examples: [] });
        const e = themeCounts.get(th); e.count++; e.bySource[c.source] = (e.bySource[c.source] || 0) + 1;
        if (txt.length <= 220) e.examples.push({ text: txt.trim(), t: t.t, source: c.source });
      }
    } else streak = 0;
    const isReq = !isCmd && !ACK.test(txt) && txt.trim().length >= 3;
    ann[i].isReq = isReq;
    if (isReq) { S.requests++; if (txt.length <= 600) prevReqs.push(ws); if (prevReqs.length > 6) prevReqs.shift(); }
    const d = t.t ? D(day(t.t)) : null;
    if (d) {
      d.userTurns++; d.h[label]++; if (isReq) d.requests++; if (cats.length) d.corrections++;
      if (d.words.length < 4000) d.words.push(...[...ws].slice(0, 40));
    }
  }
  // Assistant labels and request statuses need look-ahead.
  const nextUser = i => { for (let j = i + 1; j < turns.length; j++) if (turns[j].role === humanRole) return j; return -1; };
  let aiText = 0;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role === 'assistant') {
      aiText++;
      const j = nextUser(i);
      const nextCats = j >= 0 ? ann[j].cats || [] : [];
      const nextLabel = j >= 0 ? ann[j].label : null;
      // only label the last assistant text before the next human turn (the "reply")
      let k = i + 1; while (k < turns.length && turns[k].role !== humanRole && turns[k].role !== 'assistant') k++;
      const isReply = k >= turns.length || turns[k].role === humanRole;
      const s = norm(t.text);
      let lab = 'neutral';
      const overclaim = isReply && AI_CLAIM.test(s.slice(0, 1500)) && nextCats.some(x => ['failure-report', 'unverified-claim', 'not-followed', 'wrong-output'].includes(x));
      const bannedAsk = isReply && confirmBanDate && t.t && t.t >= confirmBanDate && AI_CONFIRM_ASK.test(s.slice(-300));
      if (AI_REFUSAL.test(s.slice(0, 600)) || overclaim || bannedAsk) lab = 'unwholesome';
      else if (isReply && (nextLabel === 'wholesome' || (j >= 0 && ACK.test(norm(turns[j].text))))) lab = 'wholesome';
      else if (AI_WARM.test(s.slice(0, 800)) && !nextCats.length) lab = 'wholesome';
      S.a[lab]++;
      if (t.t) { const d = D(day(t.t)); d.a[lab]++; d.aiTurns++; }
    }
  }
  // Requests
  for (let n = 0; n < userIdx.length; n++) {
    const i = userIdx[n];
    if (!ann[i].isReq) continue;
    const j = n + 1 < userIdx.length ? userIdx[n + 1] : -1;
    const end = j >= 0 ? j : turns.length;
    let responded = false, interrupted = false, claimed = false, toolErrors = 0;
    for (let k = i + 1; k < end; k++) {
      const r = turns[k].role;
      if (r === 'assistant' || r === 'tool') responded = true;
      if (r === 'assistant' && AI_CLAIM.test(norm(turns[k].text).slice(0, 1500))) claimed = true;
      if (r === 'tool_error') toolErrors++;
      if (r === 'system' && /^\[Request interrupted/.test(turns[k].text)) interrupted = true;
    }
    const next = j >= 0 ? ann[j] : null;
    const nextCats = next?.cats || [];
    let status;
    if (interrupted) status = 'interrupted';
    else if (userOnly) status = nextCats.includes('failure-report') ? 'failed (inferred)' : nextCats.length ? 'corrected (inferred)' : 'unknown';
    else if (!responded) status = j >= 0 ? 'superseded' : 'no-response';
    else if (nextCats.includes('failure-report')) status = 'failed';
    else if (nextCats.length) status = 'corrected';
    else if (next?.label === 'wholesome') status = 'confirmed';
    else if (j >= 0 || claimed) status = 'completed';
    else status = 'completed (unconfirmed)';
    if (responded || userOnly) {
      S.responded++;
      if (nextCats.length) S.nonAdherent++;
    }
    if (/^(completed|confirmed)/.test(status)) S.completions++;
    if (/^failed/.test(status)) S.failures++;
    const d = turns[i].t ? D(day(turns[i].t)) : null;
    if (d) {
      if (responded || userOnly) d.responded++;
      if (nextCats.length) d.nonAdherent++;
      if (/^(completed|confirmed)/.test(status)) d.completions++;
      if (/^failed/.test(status)) d.failures++;
    }
    const req = { id: `${c._file.replace(/\.json$/, '')}#${i}`, source: c.source, model: c.model, project: c.project, t: turns[i].t,
      text: turns[i].text.slice(0, 500), status, label: ann[i].label, ...(nextCats.length ? { followedBy: nextCats } : {}),
      ...(ann[i].cats?.length ? { isCorrection: ann[i].cats } : {}), ...(toolErrors ? { toolErrors } : {}) };
    requests.push(req); convReqs.push(req);
  }
  // Conversation-level scores
  const userTurns = userIdx.length;
  const adherence = S.responded ? 100 * (1 - S.nonAdherent / S.responded) : null;
  const hN = S.h.wholesome + S.h.neutral + S.h.unwholesome;
  const aN = S.a.wholesome + S.a.neutral + S.a.unwholesome;
  const coopH = coop(S.h.wholesome, S.h.unwholesome, hN);
  const coopA = coop(S.a.wholesome, S.a.unwholesome, aN);
  const cooperation = coopH != null && coopA != null ? (coopH + coopA) / 2 : coopH ?? coopA;
  const cRate = userTurns ? Math.min(1, (S.corrections + S.h.unwholesome) / userTurns) : 0;
  const aRate = aN ? S.a.unwholesome / aN : 0;
  const iRate = userTurns ? Math.min(1, S.interrupts / userTurns) : 0;
  const sNorm = Math.min(1, Math.max(0, S.maxStreak - 1) / 4);
  const harmony = userTurns ? clip(100 * (1 - 0.5 * cRate - 0.25 * aRate - 0.15 * iRate - 0.10 * sNorm)) : null;
  const tools = Object.keys(c.tools || {});
  const mcp = new Set(tools.filter(x => x.startsWith('mcp__')).map(x => x.split('__')[1]));
  const spawned = (c.tools?.Agent || 0) + (c.tools?.Task || 0) + (childCount[`claude-code-${c.id}`] || 0);
  const models = Object.keys(c.models || {}).length || 1;
  const agents = models + spawned;
  const gathering = clip(25 * Math.log2(1 + agents) + 12 * Math.log2(1 + tools.length) + 10 * Math.log2(1 + mcp.size));
  for (const t of turns) if (t.t) {
    const d = D(day(t.t)); d.conversations.add(c._file); d.sources.add(c.source); if (c.model) d.models.add(c.model); if (c.project) d.projects.add(c.project);
    if (t.role === 'tool' && t.name) d.tools.add(t.name);
  }
  if (c.source === 'claude-code-subagent' && c.started) D(day(c.started)).agents++;
  convScores.push({
    file: c._file, source: c.source, model: c.model, project: c.project, title: c.title, started: c.started, ended: c.ended,
    ...(userOnly ? { userOnly: true } : {}), ...(c.automated ? { automated: true } : {}), ...(c.parent ? { parent: c.parent } : {}),
    userTurns, aiTurns: aiText, requests: S.requests, responded: S.responded, corrections: S.corrections, repeats: S.repeats,
    completions: S.completions, failures: S.failures, interrupts: S.interrupts,
    adherence: r1(adherence), cooperation: r1(cooperation), coopHumanToAI: r1(coopH), coopAIToHuman: r1(coopA),
    harmony: r1(harmony), gathering: r1(gathering), agents, tools: tools.length, mcpServers: [...mcp],
    labels: { human: S.h, ai: S.a }, correctionTypes: S.cats,
  });
}

// ------------------------------------------------------------------ daily / monthly / per-source
function finalize(d) {
  const hN = d.h.wholesome + d.h.neutral + d.h.unwholesome;
  const aN = d.a.wholesome + d.a.neutral + d.a.unwholesome;
  const coopH = coop(d.h.wholesome, d.h.unwholesome, hN);
  const coopA = coop(d.a.wholesome, d.a.unwholesome, aN);
  const cRate = d.userTurns ? Math.min(1, (d.corrections + d.h.unwholesome) / d.userTurns) : 0;
  const aRate = aN ? d.a.unwholesome / aN : 0;
  const iRate = d.userTurns ? Math.min(1, d.interrupts / d.userTurns) : 0;
  return {
    adherence: r1(d.responded ? 100 * (1 - d.nonAdherent / d.responded) : null),
    coopHumanToAI: r1(coopH), coopAIToHuman: r1(coopA),
    cooperation: r1(coopH != null && coopA != null ? (coopH + coopA) / 2 : coopH ?? coopA),
    harmony: r1(d.userTurns ? clip(100 * (1 - 0.5 * cRate - 0.25 * aRate - 0.15 * iRate)) : null),
  };
}
// Convergence: keyword overlap between conversations of different sources/projects on the same day.
function convergence(dayKey) {
  const files = [...daily.get(dayKey).conversations];
  const sets = files.map(f => { const s = convScores.find(x => x.file === f); return s; }).filter(Boolean);
  if (sets.length < 2) return { convergence: 0, sharedGoals: [] };
  const kw = new Map();
  for (const s of sets) {
    const c = convs.find(x => x._file === s.file);
    const counts = {};
    for (const t of c.turns) if (t.role === 'user' && t.t && day(t.t) === dayKey) for (const w of words(t.text)) counts[w] = (counts[w] || 0) + 1;
    kw.set(s.file, { group: `${s.source}|${s.project}`, set: new Set(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(x => x[0])) });
  }
  const arr = [...kw.values()].filter(x => x.set.size >= 3);
  let sum = 0, pairs = 0; const shared = {};
  for (let i = 0; i < arr.length && i < 60; i++) for (let j = i + 1; j < arr.length && j < 60; j++) {
    if (arr[i].group === arr[j].group) continue;
    let inter = 0; for (const w of arr[i].set) if (arr[j].set.has(w)) { inter++; shared[w] = (shared[w] || 0) + 1; }
    sum += inter / (arr[i].set.size + arr[j].set.size - inter); pairs++;
  }
  return { convergence: pairs ? sum / pairs : 0, sharedGoals: Object.entries(shared).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]) };
}
const days = [...daily.keys()].filter(Boolean).sort();
const dailyOut = days.map(k => {
  const d = daily.get(k);
  const { convergence: cv, sharedGoals } = convergence(k);
  const gathering = clip(20 * Math.log2(1 + d.sources.size) + 15 * Math.log2(1 + d.models.size) + 10 * Math.log2(1 + d.agents) + 8 * Math.log2(1 + d.tools.size) + Math.min(30, 100 * cv));
  return {
    date: k, conversations: d.conversations.size, sources: [...d.sources], models: [...d.models], projects: d.projects.size,
    subagents: d.agents, tools: d.tools.size, userTurns: d.userTurns, aiTurns: d.aiTurns, requests: d.requests,
    corrections: d.corrections, completions: d.completions, failures: d.failures, interrupts: d.interrupts,
    labels: { human: d.h, ai: d.a }, ...finalize(d), gathering: r1(gathering), convergence: r1(cv * 100), sharedGoals,
  };
});
function rollup(keyFn) {
  const m = new Map();
  for (const k of days) {
    const d = daily.get(k); const key = keyFn(k);
    if (!m.has(key)) m.set(key, { key, conversations: new Set(), sources: new Set(), models: new Set(), userTurns: 0, aiTurns: 0, requests: 0, responded: 0, nonAdherent: 0,
      corrections: 0, completions: 0, failures: 0, interrupts: 0, agents: 0, h: { wholesome: 0, neutral: 0, unwholesome: 0 }, a: { wholesome: 0, neutral: 0, unwholesome: 0 }, gath: [] });
    const r = m.get(key);
    for (const x of d.conversations) r.conversations.add(x); for (const x of d.sources) r.sources.add(x); for (const x of d.models) r.models.add(x);
    for (const f of ['userTurns', 'aiTurns', 'requests', 'responded', 'nonAdherent', 'corrections', 'completions', 'failures', 'interrupts', 'agents']) r[f] += d[f];
    for (const s of ['h', 'a']) for (const l of ['wholesome', 'neutral', 'unwholesome']) r[s][l] += d[s][l];
    r.gath.push(dailyOut.find(x => x.date === k).gathering);
  }
  return [...m.values()].map(r => ({ period: r.key, conversations: r.conversations.size, sources: [...r.sources], models: [...r.models].slice(0, 12),
    userTurns: r.userTurns, aiTurns: r.aiTurns, requests: r.requests, corrections: r.corrections, completions: r.completions, failures: r.failures,
    interrupts: r.interrupts, subagents: r.agents, labels: { human: r.h, ai: r.a }, ...finalize(r),
    gathering: r1(r.gath.reduce((a, b) => a + b, 0) / r.gath.length) }));
}
const monthly = rollup(k => k.slice(0, 7));
const yearly = rollup(k => k.slice(0, 4));

const bySource = {};
for (const s of convScores) {
  const b = bySource[s.source] ||= { conversations: 0, userTurns: 0, requests: 0, responded: 0, nonAdherentW: 0, corrections: 0, completions: 0, failures: 0, h: { wholesome: 0, neutral: 0, unwholesome: 0 }, a: { wholesome: 0, neutral: 0, unwholesome: 0 }, harmonySum: 0, harmonyN: 0, gathSum: 0 };
  b.conversations++; b.userTurns += s.userTurns; b.requests += s.requests; b.responded += s.responded; b.corrections += s.corrections; b.completions += s.completions; b.failures += s.failures;
  b.nonAdherentW += s.adherence != null ? s.responded * (1 - s.adherence / 100) : 0;
  for (const side of ['human', 'ai']) for (const l of ['wholesome', 'neutral', 'unwholesome']) b[side === 'human' ? 'h' : 'a'][l] += s.labels[side][l];
  if (s.harmony != null) { b.harmonySum += s.harmony * s.userTurns; b.harmonyN += s.userTurns; }
  b.gathSum += s.gathering;
}
const sourceOut = Object.fromEntries(Object.entries(bySource).map(([k, b]) => {
  const hN = b.h.wholesome + b.h.neutral + b.h.unwholesome, aN = b.a.wholesome + b.a.neutral + b.a.unwholesome;
  const cH = coop(b.h.wholesome, b.h.unwholesome, hN), cA = coop(b.a.wholesome, b.a.unwholesome, aN);
  return [k, { conversations: b.conversations, userTurns: b.userTurns, requests: b.requests, corrections: b.corrections, completions: b.completions, failures: b.failures,
    adherence: r1(b.responded ? 100 * (1 - b.nonAdherentW / b.responded) : null), coopHumanToAI: r1(cH), coopAIToHuman: r1(cA),
    cooperation: r1(cH != null && cA != null ? (cH + cA) / 2 : cH ?? cA), harmony: r1(b.harmonyN ? b.harmonySum / b.harmonyN : null),
    gathering: r1(b.gathSum / b.conversations), labels: { human: b.h, ai: b.a } }];
}));

// Top corrections: themes ranked by count, with the shortest distinct examples.
const topCorrections = [...themeCounts.values()].sort((a, b) => b.count - a.count).map(e => {
  const seen = new Set();
  const ex = e.examples.filter(x => { const k = x.text.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return x.text.length >= 8; })
    .sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 5);
  return { theme: e.theme, count: e.count, bySource: e.bySource, examples: ex };
});
// Data-driven phrases from correction turns (3-5 word n-grams, deduped per turn).
const grams = {};
for (const c of convs) for (const t of c.turns) {
  if (t.role !== 'user') continue;
  const cats = correctionCats(t.text); if (!cats.length) continue;
  const toks = norm(scanText(t.text)).toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const seen = new Set();
  for (let n = 3; n <= 5; n++) for (let i = 0; i + n <= toks.length; i++) {
    const g = toks.slice(i, i + n); if (g.filter(w => !STOP.has(w)).length < 1) continue;
    const k = g.join(' '); if (seen.has(k)) continue; seen.add(k); grams[k] = (grams[k] || 0) + 1;
  }
}
const topPhrases = Object.entries(grams).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 60).map(([phrase, count]) => ({ phrase, count }));

const sum = f => convScores.reduce((a, s) => a + (s[f] || 0), 0);
const statusCounts = {}; for (const r of requests) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
const metrics = {
  generated: new Date().toISOString(), method: 'docs/agents/METRICS.md', confirmBanFirstSeen: confirmBanDate,
  totals: { conversations: convScores.length, documents: convs.filter(c => c.document).length, userTurns: sum('userTurns'), aiTurns: sum('aiTurns'),
    requests: requests.length, corrections: sum('corrections'), repeats: sum('repeats'), completions: sum('completions'), failures: sum('failures'),
    interrupts: sum('interrupts'), requestStatus: statusCounts, correctionTypes: catCounts },
  bySource: sourceOut, yearly, monthly, daily: dailyOut, topCorrections, topPhrases, conversations: convScores,
};
writeJSON(path.join(OUT, 'metrics.json'), metrics);
writeJSON(path.join(OUT, 'requests.json'), { generated: metrics.generated, total: requests.length, statusCounts, requests });
console.log('[score]', JSON.stringify(metrics.totals));
console.log('[score] bySource', JSON.stringify(sourceOut, (k, v) => (k === 'labels' ? undefined : v)));
console.log('[score] yearly', JSON.stringify(yearly.map(y => ({ y: y.period, adh: y.adherence, coop: y.cooperation, cH: y.coopHumanToAI, cA: y.coopAIToHuman, harm: y.harmony, gath: y.gathering, req: y.requests, corr: y.corrections }))));
console.log('[score] top', topCorrections.slice(0, 12).map(t => `${t.count} ${t.theme}`).join('\n'));
