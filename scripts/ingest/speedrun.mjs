// speedrun.com: full Raid-category run history (verified + new + rejected), players,
// times, video links, runner comments, examiner notes, run-page comments, and the
// game/category/variable rules text.
//   node scripts/ingest/speedrun.mjs
// Output: data/kb/raw/speedrun/runs.json, rules.json, users.json (+ _state.json)
// Incremental: run-page comments are only re-fetched for runs that are new, changed
// status, or were submitted in the last 30 days.
import path from 'node:path';
import { RAW, SRC, RUNNERS, readJson, writeJson, getJson, logNew, sleep, now, clip, isMain } from './lib.mjs';

const API = 'https://www.speedrun.com/api/v1';
const API2 = 'https://www.speedrun.com/api/v2';
const DIR = path.join(RAW, 'speedrun');
const STATUSES = ['verified', 'new', 'rejected'];

async function allRuns(status) {
  const out = [];
  for (let offset = 0; ; offset += 200) {
    const d = await getJson(`${API}/runs?game=${SRC.GAME}&category=${SRC.CAT}&status=${status}&orderby=submitted&direction=asc&max=200&offset=${offset}&embed=players`);
    out.push(...d.data);
    if (d.data.length < 200) break;
    await sleep(700);
  }
  return out;
}

const userOf = p => p.rel === 'user'
  ? { id: p.id, name: p.names?.international, twitch: p.twitch?.uri || null, youtube: p.youtube?.uri || null, country: p.location?.country?.code || null }
  : { id: null, name: p.name, guest: true };

export async function ingestSpeedrun({ log = logNew } = {}) {
  const state = await readJson(path.join(DIR, '_state.json'), { runs: {} });
  const prev = await readJson(path.join(DIR, 'runs.json'), { runs: [] });
  const prevById = Object.fromEntries((prev.runs || []).map(r => [r.id, r]));
  const users = await readJson(path.join(DIR, 'users.json'), {});
  const errors = [];
  let newRuns = 0, changed = 0, commentFetches = 0;

  // ---- runs
  const raw = [];
  for (const s of STATUSES) {
    try { raw.push(...await allRuns(s)); } catch (e) { errors.push(`runs ${s}: ${e.message}`); }
    await sleep(700);
  }
  if (!raw.length && errors.length) throw new Error(errors.join('; '));

  const runs = [];
  for (const r of raw) {
    const players = (r.players?.data || []).map(userOf);
    for (const p of players) if (p.id) users[p.id] = { ...users[p.id], ...p };
    const run = {
      id: r.id, status: r.status?.status, examiner: r.status?.examiner || null,
      examinerNote: r.status?.reason || null, verifiedAt: r.status?.['verify-date'] || null,
      players: players.map(p => p.name), playerIds: players.map(p => p.id).filter(Boolean),
      time: r.times?.primary_t ?? null, realtime: r.times?.realtime_t ?? null, igt: r.times?.ingame_t || null,
      date: r.date, submitted: r.submitted,
      bracket: r.values?.[SRC.VERSION_VAR] === SRC.NEW_BRACKET ? '1.0.0.6+' : 'Pre 1.0.0.6', values: r.values || {},
      platform: r.system?.platform || null,
      videos: (r.videos?.links || []).map(l => l.uri), videoText: r.videos?.text || null,
      comment: r.comment || null, url: r.weblink,
    };
    const old = prevById[run.id];
    const st = state.runs[run.id] || {};
    const recent = run.submitted && Date.now() - Date.parse(run.submitted) < 30 * 864e5;
    const statusChanged = old && old.status !== run.status;
    if (!old) { newRuns++; await log('speedrun.com', 'run', run.id, `${run.players.join(' & ')} ${run.time}s (${run.status})`); }
    else if (statusChanged) { changed++; await log('speedrun.com', 'run-status', run.id, `${run.players.join(' & ')} ${old.status} -> ${run.status}`); }

    // ---- run-page comments (v2 API)
    run.comments = old?.comments || [];
    if (!st.commentsAt || !old || statusChanged || (recent && Date.now() - Date.parse(st.commentsAt) > 6 * 36e5)) {
      try {
        const c = await getJson(`${API2}/GetCommentList?itemId=${run.id}&itemType=2`);
        const names = Object.fromEntries((c.userList || []).map(u => [u.id, u.name]));
        const likes = {};
        for (const l of c.likeList || []) likes[l.itemId] = (likes[l.itemId] || 0) + 1;
        const before = new Set(run.comments.map(x => x.id));
        run.comments = (c.commentList || []).filter(x => !x.deleted).slice(0, 300).map(x => ({
          id: x.id, author: names[x.userId] || x.userId, text: clip(x.text, 4000), likes: likes[x.id] || 0, ts: x.postedAt, parent: x.parentId || undefined,
        }));
        for (const x of run.comments) if (!before.has(x.id) && old) await log('speedrun.com', 'run-comment', x.id, `${x.author} on ${run.id}: ${clip(x.text, 80)}`);
        st.commentsAt = now(); commentFetches++;
        for (const u of c.userList || []) if (!users[u.id]) users[u.id] = { id: u.id, name: u.name };
      } catch (e) { errors.push(`comments ${run.id}: ${e.message}`); }
      await sleep(600);
    }
    state.runs[run.id] = { ...st, status: run.status };
    runs.push(run);
  }

  // Examiner names
  for (const id of new Set(runs.map(r => r.examiner).filter(Boolean))) {
    if (users[id]?.name) continue;
    try { const u = (await getJson(`${API}/users/${id}`)).data; users[id] = userOf({ rel: 'user', ...u }); } catch (e) { errors.push(`user ${id}: ${e.message}`); }
    await sleep(600);
  }
  for (const r of runs) if (r.examiner) r.examinerName = users[r.examiner]?.name || null;

  // Named runners not yet seen in runs (twitch/youtube links for twitch.mjs)
  for (const name of RUNNERS) {
    if (Object.values(users).some(u => u.name?.toLowerCase() === name.toLowerCase() && 'twitch' in u)) continue;
    try { const u = (await getJson(`${API}/users?lookup=${encodeURIComponent(name)}`)).data[0]; if (u) users[u.id] = userOf({ rel: 'user', ...u }); } catch (e) { errors.push(`lookup ${name}: ${e.message}`); }
    await sleep(600);
  }
  // Fill twitch/youtube for comment-only users that lack profile links (players only).
  for (const id of new Set(runs.flatMap(r => r.playerIds))) {
    if (users[id] && 'twitch' in users[id]) continue;
    try { const u = (await getJson(`${API}/users/${id}`)).data; users[id] = userOf({ rel: 'user', ...u }); } catch (e) { errors.push(`user ${id}: ${e.message}`); }
    await sleep(600);
  }

  runs.sort((a, b) => (a.submitted || '').localeCompare(b.submitted || ''));
  const counts = Object.fromEntries(STATUSES.map(s => [s, runs.filter(r => r.status === s).length]));
  await writeJson(path.join(DIR, 'runs.json'), { fetchedAt: now(), game: SRC.GAME, category: SRC.CAT, counts, runs });
  await writeJson(path.join(DIR, 'users.json'), users);

  // ---- rules
  let rulesNew = 0;
  try {
    const g = await getJson(`${API2}/GetGameData?gameId=${SRC.GAME}`);
    const valuesBy = {};
    for (const v of g.values || []) (valuesBy[v.variableId] ||= []).push({ id: v.id, name: v.name, rules: v.rules || null, archived: !!v.archived });
    const rules = {
      fetchedAt: now(), game: { id: g.game.id, name: g.game.name, rules: g.game.rules || null, updatedAt: g.game.updatedAt },
      categories: (g.categories || []).map(c => ({ id: c.id, name: c.name, archived: !!c.archived, rules: c.rules || null })),
      variables: (g.variables || []).map(v => ({ id: v.id, name: v.name, categoryId: v.categoryId || null, description: v.description || null, archived: !!v.archived, values: valuesBy[v.id] || [] })),
      moderators: (g.moderators || []).map(m => ({ userId: m.userId, name: (g.users || []).find(u => u.id === m.userId)?.name })),
    };
    const old = await readJson(path.join(DIR, 'rules.json'), null);
    const sig = x => JSON.stringify([x.game.rules, x.categories.map(c => c.rules), x.variables.map(v => v.values.map(y => y.rules))]);
    if (!old || sig(old) !== sig(rules)) { rulesNew = 1; await log('speedrun.com', 'rules', SRC.GAME, old ? 'rules changed' : 'rules fetched'); }
    await writeJson(path.join(DIR, 'rules.json'), rules);
  } catch (e) { errors.push(`rules: ${e.message}`); }

  await writeJson(path.join(DIR, '_state.json'), state);
  return { source: 'speedrun', total: runs.length, ...counts, newRuns, statusChanged: changed, commentFetches, comments: runs.reduce((n, r) => n + r.comments.length, 0), rulesChanged: rulesNew, users: Object.keys(users).length, errors };
}

if (isMain(import.meta)) console.log(JSON.stringify(await ingestSpeedrun()));
