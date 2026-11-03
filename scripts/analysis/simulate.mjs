// simulate.mjs — Monte Carlo of full raid times and the optimal reset policy.
//
//   node scripts/analysis/simulate.mjs [--user export.json] [--n 100000]
//        [--route vines-std,frag-std,thane-windjump,keep-hole,sanctum-flight]
//        [--reset-overhead 45] [--profile id]
//
// Writes data/kb/analysis/simulate.json, simulate.csv, reset-thresholds.csv.
// Math: docs/math/monte-carlo.md and docs/math/reset-dp.md.
import { join } from 'node:path';
import { getModel, sampleSegment, routeVariants, GOAL, GOAL_MARGIN, N_SPLITS, DEFAULT_CURRENT_ROUTE, TARGET_ROUTE, SEED } from './model.mjs';
import { quantileSorted, r2, r4, fmt, pct, writeJSON, writeCSV, args, isMain, OUT_DIR } from './lib.mjs';

export const RESET_OVERHEAD = 45; // seconds from pressing reset to the next timer start (load + walk-in), assumed

// One Monte Carlo batch. Run i uses counter-based randoms keyed on (seed, i), so
// two calls with the same seed and different parameters share their luck.
export function simulate(prof, route, { n = 100000, seed = SEED, ov = null, goal = GOAL, margin = GOAL_MARGIN, keep = false, stretch = null } = {}) {
  const vs = routeVariants(route);
  const fin = new Float64Array(n); let nf = 0, beat = 0, beatM = 0, beatS = 0, dead = 0, sumAll = 0, misses = 0;
  const cum = Array.from({ length: N_SPLITS }, () => []);
  const keepCum = keep ? 20000 : 0;
  for (let i = 0; i < n; i++) {
    let tot = 0, died = false;
    for (let k = 0; k < N_SPLITS; k++) {
      const s = sampleSegment(prof, k, vs[k], seed, i, ov);
      tot += s.t; misses += s.misses;
      if (s.dead) { died = true; break; }
      if (i < keepCum) cum[k].push(tot);
    }
    sumAll += tot;
    if (died) { dead++; continue; }
    fin[nf++] = tot;
    if (tot < goal) beat++;
    if (tot < margin) beatM++;
    if (stretch != null && tot < stretch) beatS++;
  }
  const f = fin.subarray(0, nf).sort();
  let mean = 0; for (let i = 0; i < nf; i++) mean += f[i]; mean /= nf || 1;
  const out = {
    n, route, pBeat: beat / n, stretch, pStretch: stretch != null ? beatS / n : null, pBeatMargin: beatM / n, pFinish: nf / n,
    pBeatGivenFinish: nf ? beat / nf : 0,
    median: quantileSorted(f, 0.5), p10: quantileSorted(f, 0.1), p90: quantileSorted(f, 0.9),
    best1in1000: quantileSorted(f, 0.001), expectedFinished: mean, expectedAttempt: sumAll / n, missesPerRun: misses / n,
    se: Math.sqrt((beat / n) * (1 - beat / n) / n),
  };
  if (keep) out.cumPace = cum.map(a => { a.sort((x, y) => x - y); return { p10: r2(quantileSorted(a, 0.1)), p50: r2(quantileSorted(a, 0.5)), p90: r2(quantileSorted(a, 0.9)) }; });
  return out;
}
export const summaryJSON = s => ({ ...s, pBeat: r4(s.pBeat), pStretch: r4(s.pStretch), pBeatMargin: r4(s.pBeatMargin), pFinish: r4(s.pFinish), pBeatGivenFinish: r4(s.pBeatGivenFinish), median: r2(s.median), p10: r2(s.p10), p90: r2(s.p90), best1in1000: r2(s.best1in1000), expectedFinished: r2(s.expectedFinished), expectedAttempt: r2(s.expectedAttempt), missesPerRun: r4(s.missesPerRun), se: r4(s.se) });

// ---------- reset policy: Dinkelbach ratio + backward DP on a time grid ----------
// State (k, t): about to run segment k with t seconds on the clock.
//   C_k(t) = E[ -r * min(D_k, G - t)  +  1{alive, t + D_k < G} * W_{k+1}(t + D_k) ]
//   W_k(t) = max(0, C_k(t))   (0 = reset now),  W_5(t) = 1{t < G}
// r is the reward rate (sub-G finishes per second). The optimal rate r* solves
//   C_0(0) - r* * R = 0   (R = reset overhead), found by bisection.
export function resetPolicy(prof, route, { goal = GOAL, R = RESET_OVERHEAD, h = 0.25, M = 40000, seed = SEED, ov = null } = {}) {
  const vs = routeVariants(route), N = Math.ceil(goal / h);
  // Each segment's distribution as a probability mass function on the grid
  // (alive: segment finished; dead: run ended by a fatal miss after that long).
  const segs = vs.map((v, k) => {
    const oa = new Map(), od = new Map();
    for (let s = 0; s < M; s++) {
      const x = sampleSegment(prof, k, v, seed ^ 0x5EED, s, ov), o = Math.min(Math.round(x.t / h), N);
      const m = x.dead ? od : oa; m.set(o, (m.get(o) || 0) + 1 / M);
    }
    const pack = m => { const e = [...m.entries()].sort((x, y) => x[0] - y[0]); return { o: Int32Array.from(e.map(x => x[0])), w: Float64Array.from(e.map(x => x[1])) }; };
    return { alive: pack(oa), dead: pack(od) };
  });
  const C = Array.from({ length: N_SPLITS }, () => new Float64Array(N));
  const W5 = new Float64Array(N).fill(1);
  const solve = (r) => {
    let next = W5, isFinal = true;
    for (let k = N_SPLITS - 1; k >= 0; k--) {
      const { alive, dead } = segs[k], Ck = C[k], rh = r * h;
      for (let i = 0; i < N; i++) {
        let acc = 0;
        for (let q = 0; q < alive.o.length; q++) {
          const o = alive.o[q], w = alive.w[q], j = i + o;
          if (j >= N) { acc -= w * rh * (N - i); continue; }
          const v = next[j];
          acc += w * ((isFinal || v > 0 ? v : 0) - rh * o);
        }
        for (let q = 0; q < dead.o.length; q++) acc -= dead.w[q] * rh * Math.min(dead.o[q], N - i);
        Ck[i] = acc;
      }
      next = Ck; isFinal = false;
    }
    return C[0][0] - r * R;
  };
  let lo = 0, hi = 0.01;
  for (let it = 0; it < 32; it++) { const mid = (lo + hi) / 2; if (solve(mid) > 0) lo = mid; else hi = mid; }
  const r = (lo + hi) / 2; solve(r);
  // Threshold after split j (= before segment j): last grid time where continuing is worth it.
  const thresholds = [];
  for (let j = 1; j < N_SPLITS; j++) {
    let last = -1; for (let i = 0; i < N; i++) if (C[j][i] > 0) last = i;
    thresholds.push(last < 0 ? null : r2(last * h));
  }
  return { goal, resetOverhead: R, gridStep: h, samplesPerSegment: M, ratePerSecond: r, successesPerHour: r * 3600, hoursPerSuccess: r > 0 ? 1 / (r * 3600) : null, thresholds };
}

// Forward-check a threshold policy by simulation: success rate per hour.
export function evalPolicy(prof, route, thresholds, { n = 100000, seed = SEED, goal = GOAL, R = RESET_OVERHEAD, ov = null } = {}) {
  const vs = routeVariants(route);
  let wins = 0, time = 0, resets = 0;
  for (let i = 0; i < n; i++) {
    let tot = 0, ok = true;
    for (let k = 0; k < N_SPLITS; k++) {
      if (k > 0 && thresholds && thresholds[k - 1] != null && tot > thresholds[k - 1]) { ok = false; resets++; break; }
      if (k > 0 && thresholds && thresholds[k - 1] == null) { ok = false; resets++; break; }
      const s = sampleSegment(prof, k, vs[k], seed ^ 0xE7A1, i, ov);
      if (s.dead) { tot += s.t; ok = false; break; }
      if (tot + s.t >= goal) { tot = goal; ok = false; break; } // clock passes the goal: reset on the spot
      tot += s.t;
    }
    if (ok && tot < goal) wins++;
    time += tot + R;
  }
  return { attempts: n, pSuccessPerAttempt: wins / n, meanAttemptSeconds: time / n, successesPerHour: wins / time * 3600, resetsAtSplits: resets / n };
}

export function analyseProfile(prof, { n = 100000, seed = SEED, R = RESET_OVERHEAD, routes = null } = {}) {
  const out = { id: prof.id, label: prof.label, kind: prof.kind, synthetic: !!prof.synthetic, routes: [] };
  const list = routes || [{ name: 'as-run', route: prof.asRun }, { name: 'current-patch default', route: DEFAULT_CURRENT_ROUTE }, { name: 'current-patch fastest', route: TARGET_ROUTE }]
    .filter((x, i, a) => a.findIndex(y => y.route.join() === x.route.join()) === i);
  for (const { name, route } of list) {
    const sim = simulate(prof, route, { n, seed, keep: true });
    const pol = resetPolicy(prof, route, { R, seed });
    const check = evalPolicy(prof, route, pol.thresholds, { n, seed, R });
    const noReset = evalPolicy(prof, route, null, { n, seed, R });
    out.routes.push({ name, route, summary: summaryJSON(sim), resetPolicy: { ...pol, meaningful: pol.successesPerHour >= 0.001, ratePerSecond: r4(pol.ratePerSecond * 1000) / 1000, successesPerHour: r4(pol.successesPerHour), hoursPerSuccess: r2(pol.hoursPerSuccess) },
      policyCheck: { ...check, pSuccessPerAttempt: r4(check.pSuccessPerAttempt), meanAttemptSeconds: r2(check.meanAttemptSeconds), successesPerHour: r4(check.successesPerHour), resetsAtSplits: r4(check.resetsAtSplits) },
      noResetBaseline: { successesPerHour: r4(noReset.successesPerHour), meanAttemptSeconds: r2(noReset.meanAttemptSeconds) } });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const a = args(), t0 = Date.now();
  const n = a.n ? +a.n : 100000, R = a['reset-overhead'] ? +a['reset-overhead'] : RESET_OVERHEAD;
  const model = getModel({ user: a.user || null, recalibrate: !!a.recalibrate });
  const routeArg = a.route ? [{ name: 'custom', route: String(a.route).split(',') }] : null;
  const profiles = model.profiles.filter(p => !a.profile || p.id === a.profile);
  const results = profiles.map(p => analyseProfile(p, { n, R, routes: routeArg }));
  writeJSON(join(OUT_DIR, 'simulate.json'), { generatedAt: new Date().toISOString(), goal: GOAL, goalMargin: GOAL_MARGIN, n, resetOverhead: R, splits: model.meta.splits, runpath: model.meta.runpath, results });
  const rows = [], trows = [];
  for (const r of results) for (const x of r.routes) {
    const s = x.summary;
    rows.push({ profile: r.id, synthetic: r.synthetic, routeName: x.name, route: x.route.join(' '), pBeat650: s.pBeat, pBeat648: s.pBeatMargin, pFinish: s.pFinish, median: s.median, p10: s.p10, p90: s.p90, expectedFinished: s.expectedFinished, missesPerRun: s.missesPerRun, subGoalPerHour_resetPolicy: x.resetPolicy.successesPerHour, subGoalPerHour_noReset: x.noResetBaseline.successesPerHour });
    trows.push({ profile: r.id, synthetic: r.synthetic, routeName: x.name, ...Object.fromEntries(model.meta.splits.slice(0, 4).map((nm, j) => [`resetAfter_${nm}`, x.resetPolicy.thresholds[j]])), subGoalPerHour: x.resetPolicy.successesPerHour, simulatedPolicyPerHour: x.policyCheck.successesPerHour });
  }
  writeCSV(join(OUT_DIR, 'simulate.csv'), rows);
  writeCSV(join(OUT_DIR, 'reset-thresholds.csv'), trows);
  for (const r of results) for (const x of r.routes) console.log(`${r.id.padEnd(20)} ${x.name.padEnd(22)} P(<6:50)=${pct(x.summary.pBeat)} P(<6:48)=${pct(x.summary.pBeatMargin)} med ${fmt(x.summary.median)} p10 ${fmt(x.summary.p10)} p90 ${fmt(x.summary.p90)} | reset after ${x.resetPolicy.thresholds.map(t => fmt(t, 1)).join(' / ')} → ${x.resetPolicy.successesPerHour.toFixed(4)}/h (sim ${x.policyCheck.successesPerHour.toFixed(4)})`);
  console.log(`(${Date.now() - t0} ms)`);
}
