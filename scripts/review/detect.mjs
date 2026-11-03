// Event detection on the per-frame features from scan.py (pure functions, testable
// against cached feature files).
//   banners  — onsets of the "EXTRACTION POINT UNLOCKED" text (splits 1-4)
//   end      — first black frame after the "GET OUT NOW!" plate (split 5)
//   loadEnd  — first frame after the loading screen into the raid (run start estimate)
// All times are video seconds.

const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Banner onsets. The plate + ornament fade in ~0.8 s before the text, so the text
// template rises from a ~0.6 plateau to >0.72 when the text appears; background noise
// stays below that and never holds it for a second.
export function bannerOnsets(f, { min = 0.7, step = 0.1, hold = 0.66, holdFrames = 12, gap = 20 } = {}) {
  const a = f.banner, fps = f.fps, t0 = f.start || 0, out = [];
  let last = -Infinity;
  for (let i = 1; i < a.length; i++) {
    if (a[i] < min) continue;
    const before = med(a.slice(Math.max(0, i - 5), i));
    if (a[i] - before < step && a[i - 1] >= min) continue;          // not an onset
    const after = a.slice(i, i + holdFrames);
    if (after.length < holdFrames / 2 || med(after) < hold) continue; // not sustained
    const t = +(t0 + i / fps).toFixed(2);
    if (t - last < gap) continue;
    out.push({ t, score: Math.max(...after) });
    last = t;
  }
  return out;
}

// Runs of frames where `pred` holds: [{i0, i1}] (inclusive).
function runs(n, pred) {
  const r = []; let s = null;
  for (let i = 0; i < n; i++) {
    if (pred(i)) { if (s === null) s = i; }
    else if (s !== null) { r.push({ i0: s, i1: i - 1 }); s = null; }
  }
  if (s !== null) r.push({ i0: s, i1: n - 1 });
  return r;
}

export const BLACK = 6; // median luminance (0-255) of a black frame

export function blackRuns(f, minFrames = 2) {
  return runs(f.med.length, i => f.med[i] <= BLACK).filter(r => r.i1 - r.i0 + 1 >= minFrames)
    .map(r => ({ t0: +((f.start || 0) + r.i0 / f.fps).toFixed(2), t1: +((f.start || 0) + (r.i1 + 1) / f.fps).toFixed(2) }));
}

// "GET OUT NOW!" plate shows for ~15 s while the countdown runs; the run ends on the
// first black frame after it.
export function endOfRun(f, { min = 0.72, minFrames = 15, after = 0 } = {}) {
  const t0 = f.start || 0;
  const plates = runs(f.getout.length, i => f.getout[i] >= min).filter(r => r.i1 - r.i0 + 1 >= 3);
  // merge plate runs separated by short dips (countdown digit / particles)
  const merged = [];
  for (const r of plates) {
    const m = merged[merged.length - 1];
    if (m && r.i0 - m.i1 <= 10) m.i1 = r.i1; else merged.push({ ...r });
  }
  const cands = merged.filter(r => r.i1 - r.i0 + 1 >= minFrames && t0 + r.i0 / f.fps > after);
  for (let k = cands.length - 1; k >= 0; k--) {
    const r = cands[k];
    for (let i = r.i0; i < Math.min(f.med.length, r.i1 + 3 * f.fps); i++) {
      if (f.med[i] <= BLACK && (f.med[i + 1] ?? 0) <= BLACK) return { t: +(t0 + i / f.fps).toFixed(2), plate: [+(t0 + r.i0 / f.fps).toFixed(2), +(t0 + r.i1 / f.fps).toFixed(2)], method: 'black after GET OUT NOW' };
    }
  }
  return null;
}

// Run start estimate: the end of the latest loading screen (black stretch with the
// spinner) that is at least `minLead` s before the first banner. A respawn black
// screen inside split 1 is closer to the banner than that.
export function loadEnd(f, firstBanner, { minLead = 40, maxLead = 600 } = {}) {
  if (firstBanner == null) return null;
  const bl = blackRuns(f, 3).filter(b => firstBanner - b.t1 >= minLead && firstBanner - b.t1 <= maxLead);
  if (!bl.length) return null;
  return bl[bl.length - 1].t1;
}

export function detectEvents(f) {
  const banners = bannerOnsets(f);
  const end = endOfRun(f, { after: banners.length ? banners[0].t : 0 });
  const start = loadEnd(f, banners[0]?.t);
  return { banners, end, loadEnd: start, scale: f.scale ?? null, scaleScore: f.scaleScore ?? null };
}
