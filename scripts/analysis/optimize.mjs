// optimize.mjs — pick the route variant per split that maximises P(beat 6:50)
// for a runner profile, and rank what to practise for the biggest gain.
//
//   node scripts/analysis/optimize.mjs [--user export.json] [--n 100000]
//        [--allow-patched] [--profile id] [--reset-overhead 45]
//
// Writes data/kb/analysis/optimize.json, routes.csv, practice-priorities.csv.
// Math: docs/math/route-optimisation.md.
import { join } from 'node:path';
import { getModel, VARIANTS, VARIANT, N_SPLITS, SEED, GOAL, pinnedSaves } from './model.mjs';
import { simulate, resetPolicy, summaryJSON, RESET_OVERHEAD } from './simulate.mjs';
import { r2, r4, pct, fmt, writeJSON, writeCSV, args, isMain, OUT_DIR } from './lib.mjs';
import { DEFAULT_CURRENT_ROUTE } from './model.mjs';

// Objective: P(beat 6:50) when it is at least 1% on the default route; otherwise
// P(beat the stretch goal) where the stretch goal is the runner's own 10th
// percentile on that route (the next milestone), so rankings are not noise.
export const STRETCH_SWITCH = 0.01;

export function candidateRoutes(allowPatched = false) {
  const opts = VARIANTS.map(vs => vs.filter(v => allowPatched || v.status !== 'patched'));
  const out = [[]];
  for (const vs of opts) { const nxt = []; for (const r of out) for (const v of vs) nxt.push([...r, v.id]); out.splice(0, out.length, ...nxt); }
  return out;
}

// Practice-able levers on a route, each evaluated with common random numbers.
function levers(prof, route) {
  const L = [];
  for (const vid of route) for (const id of VARIANT[vid].skips) {
    const sk = prof.skips[id], p2 = sk.p + (1 - sk.p) / 2;
    // Clean reps needed to move the Beta mean to p2: (a + x)/(a + b + x) = p2.
    const reps = Math.max(0, Math.ceil((p2 * (sk.a + sk.b) - sk.a) / (1 - p2)));
    L.push({ kind: 'skip', id, split: VARIANT[vid] && route.indexOf(vid), what: `${sk.name}: halve the miss rate (${pct(sk.p, 0)} → ${pct(p2, 0)})`, ov: { p: { [id]: p2 } }, reps, from: sk.p, to: r4(p2) });
  }
  // Nanobit's own pinned 'time lost here' notes (runpath.json): deterministic seconds off a split.
  for (const ps of pinnedSaves()) {
    if (ps.split == null || ps.split < 0 || (ps.requires && route[ps.split] !== ps.requires)) continue;
    L.push({ kind: 'pinned-save', split: ps.split, id: ps.piece, what: `${ps.piece}${ps.ts ? ' @' + ps.ts : ''}: ${ps.note} (−${ps.seconds} s)`, ov: { shift: Object.assign(Array(N_SPLITS).fill(0), { [ps.split]: ps.seconds }) } });
  }
  return L;
}
// All pinned saves at once (the runpath target assumes most of them).
export function allPinned(route) {
  const shift = Array(N_SPLITS).fill(0);
  for (const ps of pinnedSaves()) if (ps.split >= 0 && (!ps.requires || route[ps.split] === ps.requires)) shift[ps.split] += ps.seconds;
  return shift;
}
function paceLevers(prof) {
  const L = [];
  for (let k = 0; k < N_SPLITS; k++) {
    const seg = prof.segments[k], ex = Math.exp(seg.mu);
    L.push({ kind: 'pace', split: k, what: `Split ${k + 1}: 1 s off the clean median`, ov: { excessScale: Object.assign(Array(N_SPLITS).fill(1), { [k]: Math.max(0.05, (ex - 1) / ex) }) } });
    L.push({ kind: 'consistency', split: k, what: `Split ${k + 1}: 25% less spread (sigma × 0.75)`, ov: { sigmaScale: Object.assign(Array(N_SPLITS).fill(1), { [k]: 0.75 }) } });
  }
  return L;
}

export function optimiseProfile(prof, { n = 100000, seed = SEED, allowPatched = false, R = RESET_OVERHEAD, priorities = true, dpTop = 2 } = {}) {
  const ref = simulate(prof, DEFAULT_CURRENT_ROUTE, { n, seed });
  const useStretch = ref.pBeat < STRETCH_SWITCH;
  const stretch = useStretch ? Math.floor(ref.p10) : null;
  const obj = s => (useStretch ? s.pStretch : s.pBeat);
  const routes = candidateRoutes(allowPatched).map(route => ({ route, ...summaryJSON(simulate(prof, route, { n, seed, stretch })) }));
  routes.sort((a, b) => obj(b) - obj(a) || a.median - b.median);
  routes.forEach(r => { r.unverified = r.route.filter(id => VARIANT[id].status === 'check'); });
  const best = routes[0];
  // Practice is planned on the best route that uses only lines proven on 1.0.1.2;
  // unverified lines enter as "learn-line" levers with a caveat.
  const bestVerified = routes.find(r => !r.unverified.length) || best;
  // Safe vs fast at each split, holding the other splits at the best route.
  const perSplit = VARIANTS.map((vs, k) => vs.filter(v => allowPatched || v.status !== 'patched').map(v => {
    const route = best.route.slice(); route[k] = v.id;
    const s = routes.find(r => r.route.join() === route.join());
    return { split: k, variant: v.id, kind: v.kind, status: v.status, delta: v.delta, deltaSource: v.source, pBeat: s.pBeat, pStretch: s.pStretch, median: s.median, chosen: v.id === best.route[k] };
  }));
  // Reset-policy rate for the top routes by P(beat).
  const dp = routes.slice(0, dpTop).map(r => { const pol = resetPolicy(prof, r.route, { R, seed }); return { route: r.route, pBeat: r.pBeat, successesPerHour: r4(pol.successesPerHour), thresholds: pol.thresholds }; });
  const out = { id: prof.id, label: prof.label, kind: prof.kind, synthetic: !!prof.synthetic, objective: useStretch ? `P(beat stretch goal ${fmt(stretch)}) — P(beat 6:50) < 1%` : 'P(beat 6:50)', stretch, nRoutes: routes.length, best, bestVerified, bestByRate: dp.slice().sort((a, b) => b.successesPerHour - a.successesPerHour)[0], resetDP: dp, perSplit, routes };
  if (!priorities) return out;

  const plan = bestVerified.route;
  out.practiceRoute = plan;
  const base = simulate(prof, plan, { n, seed, stretch });
  const pr = [];
  for (const l of [...levers(prof, plan), ...paceLevers(prof)]) {
    const s = simulate(prof, plan, { n, seed, ov: l.ov, stretch });
    pr.push({ kind: l.kind, id: l.id || null, split: l.split, what: l.what, caveat: l.kind === 'skip' && prof.skips[l.id] && prof.skips[l.id].status === 'check' ? 'unverified on 1.0.1.2' : null, cleanRepsNeeded: l.reps ?? null, pBefore: r4(base.pBeat), pAfter: r4(s.pBeat), gain650: r4(s.pBeat - base.pBeat), gainStretch: useStretch ? r4(s.pStretch - base.pStretch) : null, gain: r4(obj(s) - obj(base)), medianGain: r2(base.median - s.median), meanGain: r2(base.expectedFinished - s.expectedFinished) });
  }
  // Learning a line you don't run: switch one split to it with its skips at >= 90%.
  for (let k = 0; k < N_SPLITS; k++) for (const v of VARIANTS[k]) {
    if (v.id === plan[k] || (!allowPatched && v.status === 'patched')) continue;
    const route = plan.slice(); route[k] = v.id;
    const p = Object.fromEntries(v.skips.map(id => [id, Math.max(prof.skips[id].p, 0.9)]));
    const s = simulate(prof, route, { n, seed, ov: { p }, stretch });
    pr.push({ kind: 'learn-line', id: v.id, split: k, what: `Learn ${v.id} to 90%+ on its skips and run it at split ${k + 1}`, caveat: [v.status === 'check' ? 'unverified on 1.0.1.2 — test before routing' : null, /^assumed/.test(v.source) ? 'saving is an assumed number' : 'saving measured in runpath.json'].filter(Boolean).join('; '), cleanRepsNeeded: null, pBefore: r4(base.pBeat), pAfter: r4(s.pBeat), gain650: r4(s.pBeat - base.pBeat), gainStretch: useStretch ? r4(s.pStretch - base.pStretch) : null, gain: r4(obj(s) - obj(base)), medianGain: r2(base.median - s.median), meanGain: r2(base.expectedFinished - s.expectedFinished) });
  }
  pr.sort((a, b) => b.gain - a.gain);
  out.practice = pr;
  // How much the answer leans on assumed numbers: shift each assumed delta by ±1 sd.
  // Scenarios: every pinned save at once, on the proven route and on the fastest route.
  out.scenarios = [];
  for (const [name, rt] of [['proven route', plan], ['best route', best.route]]) {
    const sh = allPinned(rt), sAll = simulate(prof, rt, { n, seed, stretch, ov: { shift: sh } });
    out.scenarios.push({ name: `all pinned saves (−${r2(sh.reduce((a, b) => a + b, 0))} s), ${name}`, route: rt, shift: sh.map(r2), pBeat: r4(sAll.pBeat), pBeatMargin: r4(sAll.pBeatMargin), median: r2(sAll.median), p10: r2(sAll.p10) });
  }
  out.sensitivity = [];
  for (let k = 0; k < N_SPLITS; k++) for (const v of VARIANTS[k]) {
    if (v.source !== 'assumed' || (!allowPatched && v.status === 'patched')) continue;
    const route = best.route.slice(); route[k] = v.id;
    const row = { variant: v.id, split: k, assumedDelta: v.delta, assumedSd: v.deltaSd, inBestRoute: v.id === best.route[k] };
    for (const [nm, d, sdv] of [['pFast', v.delta - v.deltaSd, 0], ['pAssumed', v.delta, 0], ['pSlow', v.delta + v.deltaSd, 0], ['pWithUncertainty', v.delta, v.deltaSd]]) {
      const sim = simulate(prof, route, { n, seed, stretch, ov: { delta: { [v.id]: d }, deltaSd: { [v.id]: sdv } } });
      row[nm] = r4(sim.pBeat); if (useStretch) row[nm + '_stretch'] = r4(sim.pStretch);
    }
    out.sensitivity.push(row);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const a = args(), t0 = Date.now();
  const n = a.n ? +a.n : 100000, R = a['reset-overhead'] ? +a['reset-overhead'] : RESET_OVERHEAD;
  const model = getModel({ user: a.user || null, recalibrate: !!a.recalibrate });
  const profiles = model.profiles.filter(p => !a.profile || p.id === a.profile);
  const results = profiles.map(p => optimiseProfile(p, { n, R, allowPatched: !!a['allow-patched'], priorities: p.kind !== 'lens', dpTop: p.kind === 'lens' ? 1 : 2 }));
  writeJSON(join(OUT_DIR, 'optimize.json'), { generatedAt: new Date().toISOString(), goal: GOAL, n, resetOverhead: R, allowPatched: !!a['allow-patched'], splits: model.meta.splits, runpath: model.meta.runpath, results });
  writeCSV(join(OUT_DIR, 'routes.csv'), results.flatMap(r => r.routes.map((x, i) => ({ profile: r.id, synthetic: r.synthetic, rank: i + 1, route: x.route.join(' '), pBeat650: x.pBeat, pBeat648: x.pBeatMargin, stretch: r.stretch, pStretch: x.pStretch, pFinish: x.pFinish, median: x.median, p10: x.p10, p90: x.p90 }))));
  writeCSV(join(OUT_DIR, 'practice-priorities.csv'), results.filter(r => r.practice).flatMap(r => r.practice.map((x, i) => ({ profile: r.id, synthetic: r.synthetic, rank: i + 1, ...x }))));
  for (const r of results) {
    console.log(`\n${r.id} [${r.objective}]: best ${r.best.route.join(' ')}  P(<6:50)=${pct(r.best.pBeat)} median ${fmt(r.best.median)}  | best verified ${r.bestVerified.route.join(' ')} P=${pct(r.bestVerified.pBeat)} | best by rate: ${r.bestByRate.route.join(' ')} ${r.bestByRate.successesPerHour}/h`);
    if (r.practice) r.practice.slice(0, 5).forEach((x, i) => console.log(`  ${i + 1}. +${pct(x.gain)} (6:50 +${pct(x.gain650, 3)}, mean -${x.meanGain}s)  ${x.what}${x.caveat ? ' [' + x.caveat + ']' : ''}${x.cleanRepsNeeded != null ? ` (~${x.cleanRepsNeeded} clean reps)` : ''}`));
  }
  console.log(`(${Date.now() - t0} ms)`);
}
