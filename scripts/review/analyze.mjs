// Run analysis: events (video s) → run splits, segment times, comparison with the
// reference distribution (js/data/raid.js RUNS) and anomaly flags. Pure functions.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';
import { blackRuns } from './detect.mjs';

export async function reference() {
  const raid = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'raid.js')).href);
  let route = null;
  try { route = await import(pathToFileURL(path.join(ROOT, 'js', 'data', 'route.js')).href); } catch {}
  const segs = raid.SPLITS.map((s, k) => {
    const vals = raid.RUNS.map(r => ({ run: r.key, runner: r.runner, seg: +(r.splits[k] - (k ? r.splits[k - 1] : 0)).toFixed(2) })).sort((a, b) => a.seg - b.seg);
    const v = vals.map(x => x.seg);
    return { k, name: s.name, short: s.short, min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1], best: vals[0], runs: vals,
      checkpoints: route?.ROUTE?.[k]?.skips?.map(x => ({ id: x.id, name: x.name, status: x.status })) || [] };
  });
  return { RUNS: raid.RUNS, SPLITS: raid.SPLITS, segs, byVid: Object.fromEntries(raid.RUNS.map(r => [r.vid, r])) };
}

// "6:50", "(7:40)", "11 Min", "22:35" → seconds stated in a title (null if none)
export function statedTime(title) {
  const m = String(title || '').match(/\b(\d{1,2}):(\d\d)(?:[.:](\d{1,3}))?\b/);
  if (m) return +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0);
  return null;
}

// events: detectEvents() output; f: features (for blackouts); ref: reference()
export function analyzeRun({ id, events, f, ref, statedRunTime = null }) {
  const notes = [];
  const banners = events.banners.map(b => b.t);
  const refRun = ref.byVid[id];
  let offset = null, offsetMethod = null;
  if (refRun) { offset = refRun.offset; offsetMethod = `reference (js/data/raid.js ${refRun.key}, LiveSplit/frame-read)`; }
  else if (events.loadEnd != null) { offset = events.loadEnd; offsetMethod = 'detected: end of the loading screen into the raid'; }
  else if (banners.length && banners[0] < 400) { offset = 0; offsetMethod = 'assumed: video starts at the run start (no loading screen found)'; }
  if (refRun && events.loadEnd != null) notes.push(`Loading-screen end detected at ${events.loadEnd} s (reference offset ${refRun.offset} s, diff ${(refRun.offset - events.loadEnd).toFixed(2)} s).`);

  let bannerList = banners;
  if (banners.length > 4) { notes.push(`${banners.length} banner onsets found; using the first 4 (${banners.slice(4).join(', ')} ignored).`); bannerList = banners.slice(0, 4); }
  const endV = events.end?.t ?? null;
  const videoSplits = [...bannerList, ...(endV != null ? [endV] : [])];
  const splits = offset == null ? null : videoSplits.map(t => +(t - offset).toFixed(2));

  // Segment k only when both ends are known and banners are complete up to k.
  const segmentTimes = [];
  if (splits) {
    for (let k = 0; k < 5; k++) {
      const endT = k < 4 ? splits[k] : (bannerList.length === 4 && endV != null ? splits[4] : null);
      const startT = k === 0 ? 0 : splits[k - 1];
      if (endT == null || startT == null || (k === 4 && bannerList.length < 4) || (k < 4 && k >= bannerList.length)) { segmentTimes.push(null); continue; }
      segmentTimes.push(+(endT - startT).toFixed(2));
    }
  }

  const anomalies = [];
  segmentTimes.forEach((s, k) => {
    if (s == null) return;
    const r = ref.segs[k];
    const vStart = offset + (k ? splits[k - 1] : 0), vEnd = offset + splits[k];
    if (s < r.min - 2) anomalies.push({ t: +vStart.toFixed(2), tEnd: +vEnd.toFixed(2), segment: k, name: r.name, kind: 'faster', delta: +(s - r.min).toFixed(2), seg: s,
      description: `${r.name}: ${s.toFixed(1)} s — ${(r.min - s).toFixed(1)} s faster than every reference run (best ${r.best.runner} ${r.min} s). Possible skip or route not in the reference set.` });
    else if (s > r.max + 30) anomalies.push({ t: +vStart.toFixed(2), tEnd: +vEnd.toFixed(2), segment: k, name: r.name, kind: 'slower', delta: +(s - r.max).toFixed(2), seg: s,
      description: `${r.name}: ${s.toFixed(1)} s — ${(s - r.max).toFixed(1)} s slower than every reference run (slowest ${r.max} s). Different path, deaths or a puzzle done normally.` });
  });
  if (offset != null && bannerList.length < 4 && endV != null) anomalies.push({ t: offset, tEnd: endV, segment: null, kind: 'missing-banners', delta: null,
    description: `Only ${bannerList.length} of 4 "EXTRACTION POINT UNLOCKED" banners before the end: an extraction point was bypassed (skip/out-of-map route) or the banner was hidden.` });

  // mid-run black screens (respawns, teleports, deaths) between start and end
  const blackouts = [];
  if (f && offset != null) {
    const endT = endV ?? Infinity;
    for (const b of blackRuns(f, 3)) if (b.t0 > offset + 1 && b.t1 < endT - 0.05) {
      const k = videoSplits.findIndex(t => t >= b.t0);
      blackouts.push({ t: b.t0, dur: +(b.t1 - b.t0).toFixed(2), segment: k < 0 ? null : k });
    }
  }

  const duration = splits && endV != null ? splits[splits.length - 1] : null;
  const quality = {
    bannersFound: banners.length, end: endV != null, offsetMethod,
    templateScale: events.scale, templateScore: events.scaleScore,
    complete: bannerList.length === 4 && endV != null && offset != null,
    ...(statedRunTime != null && duration != null ? { statedTime: statedRunTime, statedDiff: +(duration - statedRunTime).toFixed(2) } : {}),
  };
  if (quality.statedDiff != null && Math.abs(quality.statedDiff) > 2) notes.push(`Measured ${duration} s vs stated ${statedRunTime} s (${quality.statedDiff > 0 ? '+' : ''}${quality.statedDiff} s): check the start (offset) or a timer stopped early.`);
  return { offset, offsetMethod, videoSplits, splits, segmentTimes, duration, anomalies, blackouts, quality, notes };
}
