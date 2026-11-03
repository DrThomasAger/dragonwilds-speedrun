// Reddit: r/Dragonwilds posts about speedruns / the raid / Kuldra / skips, with comments.
//   node scripts/ingest/reddit.mjs
// Uses the public search JSON (www.reddit.com/r/Dragonwilds/search.json). Reddit
// blocks many anonymous clients (HTTP 403); if REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET
// are set (a "script"/"web" app from https://www.reddit.com/prefs/apps), it uses an
// app-only OAuth token against oauth.reddit.com instead.
// Output: data/kb/raw/reddit/posts.json {fetchedAt, posts:[{id,title,author,created,score,
//   numComments,flair,url,permalink,selftext}]}, data/kb/raw/reddit/<postId>.json
//   {id,title,...,comments:[{id,author,text,likes,ts,depth,parent}]}
// Incremental: comments are re-fetched only when a post's comment count grew.
import path from 'node:path';
import { RAW, readJson, writeJson, logNew, sleep, now, clip, isMain } from './lib.mjs';

const DIR = path.join(RAW, 'reddit');
const SUB = 'Dragonwilds';
const QUERIES = ['speedrun', 'raid', 'kuldra', 'skip', 'scorned wilderness', 'world record'];
const RELEVANT = /speed ?run|raid|kuldra|skip|scorned|world record|\bwr\b|windstep|zoop/i;
const UA = 'node:dw-raid-lab-ingest:1.0 (knowledge base for a speedrun practice app)';
const MAX_COMMENTS = 500;

async function token() {
  const id = process.env.REDDIT_CLIENT_ID, secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', body: 'grant_type=client_credentials',
    headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  });
  if (!r.ok) throw new Error(`reddit oauth ${r.status}`);
  return (await r.json()).access_token;
}

function client(tok) {
  const base = tok ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  return async function get(p) {
    // oauth.reddit.com takes the same paths without the .json suffix
    const url = base + (tok ? p.replace('.json', '') : p) + (p.includes('?') ? '&' : '?') + 'raw_json=1';
    for (let i = 0; i < 4; i++) {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...(tok ? { Authorization: `Bearer ${tok}` } : {}) } });
      if (r.status === 429) { await sleep(5000 * 2 ** i); continue; }
      if (!r.ok) { const e = new Error(`${r.status} ${url.split('?')[0]}${r.status === 403 ? ' (Reddit blocks anonymous API access from this network; set REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET)' : ''}`); e.status = r.status; throw e; }
      return r.json();
    }
    throw new Error('429 from reddit');
  };
}

const post = d => ({ id: d.id, title: d.title, author: d.author, created: new Date(d.created_utc * 1000).toISOString(), score: d.score, numComments: d.num_comments, flair: d.link_flair_text || null, url: d.url, permalink: 'https://www.reddit.com' + d.permalink, selftext: clip(d.selftext || '', 10000) });

function flatten(children, depth = 0, parent = null, out = []) {
  for (const c of children || []) {
    if (c.kind !== 't1' || out.length >= MAX_COMMENTS) continue;
    const d = c.data;
    if (depth > 6) continue; // truncate absurdly deep threads
    out.push({ id: d.id, author: d.author, text: clip(d.body || '', 3000), likes: d.score, ts: new Date(d.created_utc * 1000).toISOString(), depth, ...(parent ? { parent } : {}) });
    if (d.replies?.data?.children) flatten(d.replies.data.children, depth + 1, d.id, out);
  }
  return out;
}

export async function ingestReddit({ log = logNew } = {}) {
  const stats = { source: 'reddit', posts: 0, newPosts: 0, commentFetches: 0, comments: 0, newComments: 0, errors: [] };
  let tok = null;
  try { tok = await token(); } catch (e) { stats.errors.push(e.message); }
  const get = client(tok);
  stats.auth = tok ? 'oauth' : 'anonymous';

  const prev = await readJson(path.join(DIR, 'posts.json'), { posts: [] });
  const byId = Object.fromEntries(prev.posts.map(p => [p.id, p]));
  const found = new Map();
  for (const q of QUERIES) {
    try {
      for (let after = null, page = 0; page < 4; page++) {
        const d = await get(`/r/${SUB}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=100&t=all${after ? '&after=' + after : ''}`);
        for (const c of d.data.children) if (c.kind === 't3' && RELEVANT.test(c.data.title + ' ' + (c.data.selftext || ''))) found.set(c.data.id, post(c.data));
        after = d.data.after; if (!after) break;
        await sleep(1200);
      }
    } catch (e) {
      stats.errors.push(`search "${q}": ${e.message}`);
      if (e.status === 403) { stats.blocked = e.message; break; }
    }
    await sleep(1200);
  }
  if (stats.blocked) return stats; // nothing written; previous data stays as-is

  for (const p of found.values()) {
    const old = byId[p.id];
    const file = path.join(DIR, `${p.id}.json`);
    const have = await readJson(file, null);
    if (!old) { stats.newPosts++; await log('reddit', 'post', p.id, p.title); }
    if (!have || (old && p.numComments > old.numComments)) {
      try {
        const d = await get(`/r/${SUB}/comments/${p.id}.json?limit=500&depth=7&sort=top`);
        const comments = flatten(d[1]?.data?.children);
        const seen = new Set((have?.comments || []).map(c => c.id));
        if (have) for (const c of comments) if (!seen.has(c.id)) { stats.newComments++; await log('reddit', 'comment', c.id, `${c.author} on ${p.id}: ${clip(c.text, 80)}`); }
        await writeJson(file, { ...p, comments, truncated: comments.length >= MAX_COMMENTS || undefined, fetchedAt: now() });
        stats.commentFetches++;
      } catch (e) { stats.errors.push(`comments ${p.id}: ${e.message}`); }
      await sleep(1200);
    }
    stats.comments += (await readJson(file, { comments: [] })).comments.length;
  }
  const posts = [...new Map([...prev.posts, ...found.values()].map(p => [p.id, p])).values()].sort((a, b) => b.created.localeCompare(a.created));
  stats.posts = posts.length;
  await writeJson(path.join(DIR, 'posts.json'), { fetchedAt: now(), subreddit: SUB, queries: QUERIES, posts });
  return stats;
}

if (isMain(import.meta)) console.log(JSON.stringify(await ingestReddit()));
