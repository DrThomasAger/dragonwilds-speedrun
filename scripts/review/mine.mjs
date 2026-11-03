// Keyword mining of transcripts / comments and the "known mechanics" vocabulary used to
// flag candidate NEW mechanics. Pure functions (tests run them on cached transcripts).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJson } from './lib.mjs';

// topic → regex. A line is kept when it hits at least one TECHNIQUE topic.
export const TOPICS = {
  movement: /\b(zoop\w*|dash\w*|surge\w*|wind ?step\w*|wind ?jump\w*|double[- ]?jump\w*|infinite jump|fly(ing)?|flight|plunge\w*|dive\w*|jump[- ]?attack|glid\w*|sprint\w*|bunny ?hop\w*|momentum|launch\w*)\b/i,
  skip: /\b(skip\w*|clip\w*|hole|through the (wall|floor|gate|door|rock)|wall|out of bounds|oob|void|shortcut|cut ?through|bypass\w*|cheese\w*)\b/i,
  cancel: /\b(cancel\w*|animation|lag|buffer\w*|frame[- ]?perfect|input|macro\w*|spam\w*)\b/i,
  glitch: /\b(glitch\w*|bug\w*|exploit\w*|broke(n)?|patch(ed|es)?|fix(ed)?|hotfix|unpatched)\b/i,
  trick: /\b(trick\w*|strat\w*|tech|secret|hidden|nobody knows|new (way|route|skip|tech)|found)\b/i,
  timing: /\b(faster|slower|time ?save|sav(e|es|ed|ing) (a|\d+|some|like) ?(second|sec)s?|sum of best|pb|personal best|world record|wr|sub[- ]?\d+|pace|split)\b/i,
  mistake: /\b(miss(ed|ing)?|fail\w*|die[ds]?|dead|death|reset\w*|messed|choke\w*|throw|threw|go to die|risk\w*|rng|lucky|unlucky)\b/i,
  respawn: /\b(respawn\w*|checkpoint\w*|teleport\w*|recall\w*|load(ing)?( screen)?)\b/i,
};
export const TECHNIQUE = ['movement', 'skip', 'cancel', 'glitch', 'trick', 'timing', 'mistake', 'respawn'];

// Raid places/objects — used as context, and to describe what a line is about.
export const PLACES = /\b(vines?|fragments?|ghornfell|stronghold|keep|cataclysm|sanctum|kuldra|heart|thane|garou|demon|abyssal|soulscourge|dragon|necro\w*|poison|maze|pylon|puzzle|orb|anima|extraction|needle|pillar|bridge|rock|rubble|ledge|door|gate|island|plague king|urn|blocks?|stairs|tower|cliff|water|air|fire|earth)\b/gi;

export function topicsOf(text) {
  return Object.entries(TOPICS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

// [{t,text}] → [{t,text,topics,places}] for lines that hit a technique topic.
export function mineLines(lines) {
  const out = [];
  for (const l of lines || []) {
    const topics = topicsOf(l.text);
    if (!topics.some(t => TECHNIQUE.includes(t))) continue;
    const places = [...new Set((l.text.match(PLACES) || []).map(s => s.toLowerCase()))];
    out.push({ t: l.t, text: l.text, topics, ...(places.length ? { places } : {}) });
  }
  return out;
}

// Phrase search used by tests and the CLI ("where all runs go to die").
export function findPhrase(lines, phrase) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const p = norm(phrase);
  return (lines || []).filter(l => norm(l.text).includes(p));
}

// ---------- known mechanics vocabulary ----------
const STOP = new Set('the a an and or but to of in on at for with from into onto over under this that these those there here then than you your i im i\'m me my we our it its it\'s is are was were be been being have has had do does did just so like get got go going gonna wanna really very right okay ok yeah yes no not now all some any can could would should will one two three time run runs little bit good nice let lets let\'s see what where when how why who up down out off again back way thing things gotta kind sort actually maybe probably pretty make made know think want need look come came take took give put said say well also even still much more most too only through about because guys guy man dude oh uh um ah hey right yep okay'.split(/\s+/));

export const words = s => (String(s || '').toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(w => !STOP.has(w));

export async function knownMechanics() {
  const names = [], corpus = [];
  try {
    const { ROUTE, TECH } = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'route.js')).href);
    for (const sp of ROUTE) { corpus.push(sp.summary); for (const s of sp.skips) { names.push({ id: s.id, name: s.name, src: 'route.js' }); corpus.push(s.name, s.text || '', ...(s.how || [])); } }
    for (const t of TECH) { names.push({ id: t.id, name: t.name, src: 'route.js' }); corpus.push(t.name, ...(t.how || [])); }
  } catch (e) { corpus.push(); }
  try {
    const { PATCHES } = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'raid.js')).href);
    for (const p of PATCHES) corpus.push(p.quote || '', p.text || '');
  } catch {}
  const g = await readJson(path.join(ROOT, 'data', 'kb', 'glitches.json'), null);
  for (const x of g?.glitches || []) {
    names.push({ id: x.id, name: x.name, src: 'glitches.json', aka: x.aka || [] });
    corpus.push(x.name, ...(x.aka || []), x.where || '', ...(Array.isArray(x.how) ? x.how : [x.how || '']), x.category || '');
  }
  const vocab = new Set(corpus.flatMap(words));
  return { names, vocab };
}

// Which known mechanic a line most likely talks about (word overlap with name + aka).
export function matchKnown(text, known) {
  const w = new Set(words(text));
  let best = null;
  for (const k of known.names) {
    const kw = [...new Set(words([k.name, ...(k.aka || [])].join(' ')))].filter(x => !['skip', 'raid', 'the', 'new'].includes(x));
    if (!kw.length) continue;
    const hit = kw.filter(x => w.has(x)).length / kw.length;
    if (hit >= 0.5 && (!best || hit > best.score)) best = { id: k.id, name: k.name, src: k.src, score: +hit.toFixed(2) };
  }
  return best;
}

// A mined line is a candidate NEW mechanic when it talks about a skip / glitch / trick /
// clip / cancel AND either names nothing known or contains specific words that appear
// nowhere in route.js / glitches.json / patch notes.
const STRONG = /\b(skip\w*|clip\w*|glitch\w*|exploit\w*|trick\w*|hole|zoop\w*|cancel\w*|through the (wall|floor|gate|door|rock)|out of bounds|oob|bypass\w*|new (way|route|skip|tech|strat))\b/i;
const GENERIC = (('thanks thank comments comment subscribe subs video videos channel link https http www youtube youtu watch lmao lol haha best work works worked working '
  + 'done clearly amount judging clean finding found latest runescape dragonwilds dragonwild what\'s there\'s that\'s didn\'t don\'t can\'t won\'t it\'ll i\'ll you\'re we\'re they\'re '
  + 'step-by-step step voice guide guides tell which saved save drop dropping updated update chapters chapter follow along commentary music getting killing '
  + 'charged first second third last next before after quick quickly fast faster slow slower easy hard harder hardest whole entire full part area section spot place '
  + 'kinda super literally basically gonna trying tried try sure stuff something anything everything nothing someone everyone people'));
for (const w of GENERIC.split(/\s+/)) STOP.add(w);

const strip = s => String(s || '').replace(/https?:\/\/\S+/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/@[\w.-]+/g, ' ');

// Returns null for lines that only mention known mechanics; otherwise the line with the
// words no known source uses (`unseen`) and the closest known mechanic, if any.
export function candidateFromLine(l, known) {
  const text = strip(l.text);
  if (!STRONG.test(text)) return null;
  const unseen = [...new Set(words(text).filter(w => !known.vocab.has(w) && w.length >= 4))];
  const places = text.match(PLACES) || [];
  const k = matchKnown(text, known);
  if (k && k.score >= 0.6) return null;                 // clearly a known mechanic
  if (!unseen.length && !places.length) return null;     // nothing specific to go on
  if (k && unseen.length < 2) return null;
  return { t: l.t, quote: l.text, unseen: unseen.slice(0, 8), nearestKnown: k };
}
