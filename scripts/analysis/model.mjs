// model.mjs — per-segment time distributions and skip success model for the
// Scorned Wilderness raid ("beat 6:50.00").
//
//   node scripts/analysis/model.mjs [--user export.json] [--seed n]
//   DW_RUNPATH=path/to/runpath.json node scripts/analysis/model.mjs   (override)
//
// Writes data/kb/analysis/model.json (every profile's fitted parameters) and
// data/kb/analysis/synthetic-new-runner.export.json (a SYNTHETIC dw_lab_v2 export
// used to exercise the user-data path). Math: docs/math/segment-distributions.md
// and docs/math/bayesian-shrinkage.md.
//
// Segment model (per runner profile, per split k), measured on the REFERENCE LINE
// (the lines Nanobit's 7:01 used — the newest complete run):
//   T_k = c_k + exp(mu_k + sigma_k * Z) + delta(variant) + sum of miss costs
//   c_k = SHIFT_FRAC * (community best segment k)    — the floor no attempt beats
//   Z ~ N(0,1);  median clean segment on the reference line = c_k + exp(mu_k)
// A variant (route line) shifts the split by delta seconds relative to the
// reference line; deltas are measured piece-by-piece in runpath.json.
// Skip j: success ~ Bernoulli(p_j), p_j = mean of Beta(1+made, 1+missed) from the
// practice log (status prior when there is no log). A miss adds loss_j seconds
// and with probability fatal_j ends the run.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RUNS, SPLITS, communityBest, RECORD, targetPace } from '../../js/data/raid.js';
import { ROUTE } from '../../js/data/route.js';
import { U, Z, strHash, rng, mean, sd, median, r2, r4, readJSON, writeJSON, args, isMain, OUT_DIR, ROOT, RUNPATH_DEFAULT, fmt, sum } from './lib.mjs';

export const GOAL = RECORD.time;   // 410.00 — beat means strictly faster
export const GOAL_MARGIN = 408.0;  // 6:48.00
export const N_SPLITS = SPLITS.length;
export const SHIFT_FRAC = 0.85;
export const SEED = 20261103;

// ---------- reference data ----------
export const segsOf = splits => splits.map((s, k) => (s == null || (k && splits[k - 1] == null) ? null : s - (k ? splits[k - 1] : 0)));
export const REF = RUNS.map(r => ({ key: r.key, runner: r.runner, label: r.label, time: r.time, patch: r.patch, segs: segsOf(r.splits) }));
export const BEST = communityBest(RUNS);
export const SHIFT = BEST.map(b => SHIFT_FRAC * b.seg);
const REFRUN = Object.fromEntries(REF.map(r => [r.key, r]));

// ---------- runpath.json (skip-level timings) ----------
export const RUNPATH_PATHS = [process.env.DW_RUNPATH, join(ROOT, 'data', 'kb', 'runpath.json'), RUNPATH_DEFAULT].filter(Boolean);
export function loadRunpath(paths = RUNPATH_PATHS) {
  for (const p of [].concat(paths)) {
    if (!p || !existsSync(p)) continue;
    try { return { path: p, data: readJSON(p) }; } catch (e) { return { path: p, error: String(e.message || e) }; }
  }
  return null;
}
export const RP = loadRunpath();
const RPD = RP && RP.data;
// Duration of a runpath piece ('C9->C11') for a run key ('nano', 'tp650', 'dotxy', ...).
export function piece(seg, run) {
  const s = RPD && (RPD.segments || []).find(x => x.seg === seg);
  const r = s && s.runs && s.runs[run];
  return r && r.dur != null ? +r.dur : null;
}
// Split index containing a piece, by its start time in Nanobit's run.
export function pieceSplit(seg) {
  const t = RPD && RPD.run_times && RPD.run_times.nano;
  if (!t) return null;
  const start = t[seg.split('->')[0]];
  const ends = ['S1', 'S2', 'S3', 'S4', 'END'].map(x => t[x]);
  return ends.findIndex(e => e > start);
}
// Pace ratio of SamF to Nanobit on pieces both ran with the same strat (valid on 1.0.1.2).
function samfRatio() {
  const common = ['C0->C1', 'C1->C2', 'C2->C3', 'C5->C6', 'C6->S2', 'S3->C9', 'C13->END'];
  const a = common.map(s => piece(s, 'samf')), b = common.map(s => piece(s, 'nano'));
  if (a.some(x => x == null) || b.some(x => x == null)) return null;
  return { pieces: common, ratio: sum(a) / sum(b) };
}
// Measured deltas vs the reference line, with documented fallbacks if runpath is absent.
function measured() {
  const d = (a, b, fb, note) => (a != null && b != null ? { v: r2(a - b), src: `runpath: ${note}` } : { v: fb, src: 'assumed (runpath missing)' });
  const sr = samfRatio();
  const samfSplit = (() => { const s = REFRUN.samf11.segs, n = REFRUN.nano701.segs; const rho = sum(s.slice(0, 3)) / sum(n.slice(0, 3)); return { rho, delta: s[3] / rho - n[3] }; })();
  const puzzle = sr && piece('C9->C11', 'samf') != null
    ? { v: r2(piece('C9->C11', 'samf') / sr.ratio - piece('C9->C11', 'nano')), src: `runpath: SamF puzzle C9->C11 ${piece('C9->C11', 'samf')} / pace ratio ${sr.ratio.toFixed(3)} (7 common pieces) − Nanobit hole ${piece('C9->C11', 'nano')}` }
    : { v: r2(samfSplit.delta), src: `split level: SamF Keep / pace ratio ${samfSplit.rho.toFixed(3)} − Nanobit Keep` };
  const heartMiss = RPD && (RPD.nanobit_pinned_saves || []).find(x => x.seg === 'C12->C13' && /safespot/i.test(x.note));
  return {
    vinesDirect: d(piece('C3->S1', 'tp650'), piece('C3->S1', 'nano'), -6, 'TexasPete direct line C3->S1 − Nanobit zoop'),
    thaneLaunch: d(piece('S2->S3', 'ftg'), piece('S2->S3', 'nano'), -11, 'FastTipsGaming launch S2->S3 − Nanobit Thane kill + air door'),
    thaneWall: d(piece('S2->S3', 'tp650'), piece('S2->S3', 'nano'), -11.4, 'TexasPete wall climb (patched) − Nanobit'),
    keepBlue: d(piece('C9->C11', 'tp650'), piece('C9->C11', 'nano'), 8.6, 'TexasPete blue-rock Keep skip (patched) − Nanobit hole'),
    keepPuzzle: puzzle,
    flight: d(piece('C11->C12', 'dotxy'), piece('C11->C12', 'nano'), 17, 'Dotxy flight demo C11->C12 − blocks windstep'),
    fightSkip: d(piece('C11->C12', 'ftg'), piece('C11->C12', 'nano'), 23, 'FastTipsGaming fight skip C11->C12 − blocks windstep'),
    heartMiss: heartMiss ? { v: heartMiss.est_s, src: `runpath: Nanobit pinned note ${heartMiss.video_ts} (${heartMiss.note})` } : { v: 6, src: 'assumed' },
    samfRatio: sr,
  };
}
export const MEAS = measured();

// ---------- route variants ----------
// delta = seconds vs the reference line. status: works | new | check (unverified
// on 1.0.1.2) | patched. Patched lines exist only to reproduce the record runs.
const V = (id, name, kind, status, skips, delta, deltaSd, source) => ({ id, name, kind, status, skips, delta, deltaSd, source });
export const VARIANTS = [
  [V('vines-std', 'Nanobit 1.0.1 line: air vent, soulscourge, black dragon, vines zoop to Fragments', 'safe', 'works', ['s-airvent', 's-soul', 's-bd1', 's-necro'], 0, 0, 'reference line'),
   V('vines-direct', 'TexasPete direct line off the BD ledge to Fragments (unverified on 1.0.1.2)', 'fast', 'check', ['s-airvent', 's-soul', 's-bd1', 'x-vines-direct'], MEAS.vinesDirect.v, 1, MEAS.vinesDirect.src)],
  [V('frag-std', 'Poison area skip + Surge/Phase Dash past the Abyssal Demon', 'safe', 'works', ['s-poison', 's-demon'], 0, 0, 'reference line')],
  [V('thane-windjump', 'Kill the air Garou Thane through the gate, windjump to the air door (Nanobit)', 'safe', 'works', ['s-thane'], 0, 0, 'reference line'),
   V('thane-launch', 'FastTipsGaming no-kill launch: rocks left of the door, windstep, glide to the forest (unverified in a run)', 'fast', 'check', ['x-thane-launch'], MEAS.thaneLaunch.v, 1.5, MEAS.thaneLaunch.src),
   V('thane-wallclimb', 'TexasPete wall climb without the Thane kill — PATCHED 1.0.1', 'fast', 'patched', ['s-thane'], MEAS.thaneWall.v, 0, MEAS.thaneWall.src)],
  [V('keep-hole', 'Parkour + the Keep hole / rib clip (IINo1goodII, notmusty1; Nanobit)', 'fast', 'new', ['s-parkour', 's-keep'], 0, 0, 'reference line'),
   V('keep-puzzle', 'Parkour + elemental puzzle done normally', 'safe', 'works', ['s-parkour'], MEAS.keepPuzzle.v, 6, MEAS.keepPuzzle.src),
   V('keep-bluerock', 'Old Keep skip (blue rock climb) — PATCHED 1.0.1', 'fast', 'patched', ['s-parkour'], MEAS.keepBlue.v, 0, MEAS.keepBlue.src)],
  [V('sanctum-blocks', 'Windstep up the blocks (all record runs) — PATCHED 1.0.1.2', 'fast', 'patched', ['s-heart'], 0, 0, 'reference line'),
   V('sanctum-flight', "Dotxy's flight through the Sanctum (jump-attack cancel loop)", 'fast', 'new', ['s-flight', 's-heart'], MEAS.flight.v, 2, MEAS.flight.src + ' (demo, not a run: ±2 s)'),
   V('sanctum-fightskip', "FastTipsGaming's post-1.0.1.2 route: drop into the void, crystal islands", 'fast', 'check', ['s-kuldra', 's-heart'], MEAS.fightSkip.v, 2, MEAS.fightSkip.src),
   V('sanctum-fight', 'Safe: no skip, fight Kuldra', 'safe', 'works', ['s-heart'], r2(MEAS.fightSkip.v + 40), 10, 'assumed: fight-skip line + 40 s (no timed 1.0.1.2 fight)')],
];
export const VARIANT = Object.fromEntries(VARIANTS.flat().map(v => [v.id, v]));
export const DEFAULT_CURRENT_ROUTE = ['vines-std', 'frag-std', 'thane-windjump', 'keep-hole', 'sanctum-flight'];
// The route the runpath target pace (6:48.1) is built on: fastest 1.0.1.2 lines incl. unverified ones.
export const TARGET_ROUTE = ['vines-direct', 'frag-std', 'thane-launch', 'keep-hole', 'sanctum-flight'];
// The lines each record run actually used (reproduces their splits exactly).
export const AS_RUN = {
  tp650: ['vines-direct', 'frag-std', 'thane-wallclimb', 'keep-bluerock', 'sanctum-blocks'],
  nano701: ['vines-std', 'frag-std', 'thane-windjump', 'keep-hole', 'sanctum-blocks'],
};

// ---------- skips ----------
const EXTRA_SKIPS = {
  'x-vines-direct': { name: 'TexasPete direct line to Fragments', status: 'check', split: 0 },
  'x-thane-launch': { name: 'FastTipsGaming Thane launch', status: 'check', split: 2 },
};
export const SKIP_META = { ...Object.fromEntries(ROUTE.flatMap((sp, k) => sp.skips.map(s => [s.id, { id: s.id, name: s.name, status: s.status, split: k }]))), ...EXTRA_SKIPS };
// Cost of a miss (seconds) and chance a miss ends the run (documented defaults;
// s-keep / s-heart / x-* are tied to measured pieces).
export const MISS = {
  's-airvent': { loss: 4, fatal: 0, why: 'walk to the vent the slow way' },
  's-soul': { loss: 8, fatal: 0.1, why: 'soulscourge catches you; tank or die' },
  's-bd1': { loss: 10, fatal: 0.05, why: 'black dragon aggro' },
  's-necro': { loss: 12, fatal: 0.05, why: 'short zoop: walk the necro area edge' },
  'x-vines-direct': { loss: r2(-MEAS.vinesDirect.v + 4), fatal: 0.1, why: 'line fails → take the zoop (measured line gap + ~4 s)' },
  's-vines-old': { loss: 10, fatal: 0, why: 'fall back to the standard line' },
  's-poison': { loss: 15, fatal: 0.05, why: 'walk through part of the poison area' },
  's-demon': { loss: 8, fatal: 0.1, why: 'Abyssal Demon hit; re-dash' },
  's-thane': { loss: 20, fatal: 0.1, why: 'fall from the rubble pile; re-climb and re-charge air' },
  'x-thane-launch': { loss: r2(-MEAS.thaneLaunch.v + 5), fatal: 0.1, why: 'launch fails → Thane kill + air door (measured gap + ~5 s)' },
  's-parkour': { loss: 8, fatal: 0.05, why: 'missed jump; re-climb' },
  's-keep': { loss: r2(MEAS.keepPuzzle.v + 6), fatal: 0, why: 'hole fails → do the puzzle (measured puzzle cost + ~6 s wasted)' },
  's-kuldra': { loss: 48, fatal: 0, why: 'skip fails → fight Kuldra (assumed fight cost + ~8 s wasted)' },
  's-flight': { loss: 15, fatal: 0.1, why: 'drop out of the loop; climb again' },
  's-heart': { loss: MEAS.heartMiss.v, fatal: 0.02, why: `missed melee safespot (${MEAS.heartMiss.src})` },
};
// Status priors used when a profile has no practice log for a skip (execution
// risk only; whether an unverified line still works at all is flagged separately).
export const STATUS_PRIOR = {
  elite: { works: [19, 1], new: [8, 2], check: [8, 2], patched: [19, 1] },
  runner: { works: [7, 3], new: [5, 5], check: [5, 5], patched: [7, 3] },
};

function skipTable(tier, logs = {}, lostOverrides = {}) {
  const out = {};
  for (const id of Object.keys(MISS)) {
    const meta = SKIP_META[id] || { status: 'works' };
    const log = logs[id];
    const made = log ? log.filter(x => x.ok).length : 0, missed = log ? log.length - made : 0;
    let a, b, source;
    if (made + missed > 0) { a = 1 + made; b = 1 + missed; source = 'practice log: Beta(1+made, 1+missed)'; }
    else { [a, b] = STATUS_PRIOR[tier][meta.status] || STATUS_PRIOR[tier].works; source = `status prior (${tier}, ${meta.status}): Beta(${a}, ${b})`; }
    const loss = lostOverrides[id] != null ? +lostOverrides[id] : MISS[id].loss;
    out[id] = { id, name: meta.name || id, status: meta.status, made, missed, a, b, p: r4(a / (a + b)), loss, fatal: MISS[id].fatal, source, lossSource: lostOverrides[id] != null ? 'your practice note (lost)' : MISS[id].why };
  }
  return out;
}

// ---------- user export (localStorage dw_lab_v2) ----------
export function parseExport(raw) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  let s = raw;
  if (s && s.dw_lab_v2) s = typeof s.dw_lab_v2 === 'string' ? JSON.parse(s.dw_lab_v2) : s.dw_lab_v2;
  const timer = s.timer || (s.attempts ? s : {});
  const attempts = (timer.attempts || []).map(a => ({ ...a, splits: (a.splits || []).slice(0, N_SPLITS) }));
  const fromAttempts = SPLITS.map(() => []);
  for (const a of attempts) {
    const sp = [...a.splits]; while (sp.length < N_SPLITS) sp.push(null);
    segsOf(sp).forEach((t, k) => { if (t != null && t > 0) fromAttempts[k].push(t); });
  }
  const fromPractice = SPLITS.map((_, k) => ((s.segPractice || {})[k] || (s.segPractice || {})[String(k)] || []).map(x => +x.t).filter(t => t > 0));
  const logs = {}, lost = {};
  for (const [id, v] of Object.entries(s.practice || {})) { if (v && v.log) logs[id] = v.log; if (v && v.lost != null) lost[id] = v.lost; }
  const done = attempts.filter(a => a.done && a.time != null).map(a => +a.time);
  return {
    synthetic: !!(raw._synthetic || s._synthetic), note: raw._note || s._note || null,
    attempts, done, pb: timer.pb ? timer.pb.time : (done.length ? Math.min(...done) : null), best: timer.best || [],
    segSamples: SPLITS.map((_, k) => [...fromAttempts[k], ...fromPractice[k]]), fromAttempts, fromPractice, logs, lost,
    route: s.analysisRoute || raw.analysisRoute || null,
  };
}

// ---------- the segment sampler (shared by simulate/optimize/calibration) ----------
const KEY_SEG = SPLITS.map((_, k) => strHash(`seg${k}`)), KEY_DRAW = SPLITS.map((_, k) => strHash(`draw${k}`));
const KEY_SKIP = Object.fromEntries(Object.keys(MISS).map(id => [id, strHash(id)]));
const KEY_VAR = Object.fromEntries(VARIANTS.flat().map(v => [v.id, strHash(v.id)]));
// ov: { sigmaScale:[k], excessScale:[k], shift:[k] (seconds saved), p:{skipId},
//       loss:{skipId}, delta:{variantId}, deltaSd:{variantId} }
export function sampleSegment(prof, k, variant, seed, run, ov) {
  const seg = prof.segments[k];
  let mu = seg.mu, sigma = seg.sigma;
  if (seg.draws) { const i = Math.floor(U(seed, run, KEY_DRAW[k]) * seg.draws.mu.length); mu = seg.draws.mu[i]; sigma = seg.draws.sigma[i]; }
  if (ov && ov.sigmaScale) sigma *= ov.sigmaScale[k] ?? 1;
  let ex = Math.exp(mu + sigma * Z(seed, run, KEY_SEG[k]));
  if (ov && ov.excessScale) ex *= ov.excessScale[k] ?? 1;
  const dl = ov && ov.delta && ov.delta[variant.id] != null ? ov.delta[variant.id] : variant.delta;
  const dsd = ov && ov.deltaSd && ov.deltaSd[variant.id] != null ? ov.deltaSd[variant.id] : variant.deltaSd;
  let t = seg.c + ex + dl - (ov && ov.shift ? ov.shift[k] || 0 : 0);
  if (dsd) t += dsd * Z(seed, run, KEY_VAR[variant.id] ?? strHash(variant.id));
  let dead = false, misses = 0;
  for (const id of variant.skips) {
    const sk = prof.skips[id], key = KEY_SKIP[id] ?? strHash(id);
    const p = ov && ov.p && ov.p[id] != null ? ov.p[id] : sk.p;
    if (U(seed, run, key, 0) >= p) {
      misses++;
      t += ov && ov.loss && ov.loss[id] != null ? ov.loss[id] : sk.loss;
      if (U(seed, run, key, 1) < sk.fatal) { dead = true; t *= U(seed, run, key, 2); break; }
    }
  }
  return { t: Math.max(t, 1), dead, misses };
}
export const routeVariants = route => route.map((id, k) => { const v = VARIANT[id]; if (!v) throw new Error(`unknown variant ${id} for split ${k}`); return v; });

// ---------- calibration of record-holder profiles ----------
// A PB is the best of many attempts, not a typical run. Nanobit: PB 7:01.97 and
// sum of best 6:51 after 177 attempts. Model each attempt's segments as i.i.d.
// draws; n_k attempts reach split k (n_0 = 177, completion fraction f → n_4).
// Find (sigma, lambda) such that E[min completed total] = PB and E[sum of
// per-split minima] = SOB, where reference-line medians are lambda × PB segments
// (moved onto the reference line).
export const CAL = { attempts: 177, completeFrac: 0.3, reps: 100, sob: 411, sobRunner: 'Nanobit' };
const reach = (N, f) => SPLITS.map((_, k) => Math.max(1, Math.round(N * Math.pow(f, k / (N_SPLITS - 1)))));
// A record run's splits moved onto the reference line: subtract its as-run deltas.
export const refLineSegs = key => REFRUN[key].segs.map((s, k) => s - (AS_RUN[key] ? VARIANT[AS_RUN[key][k]].delta : 0));

function makeRefProfile({ id, label, base, lambda, sigma, asRun, tier = 'elite', kind = 'reference', note }) {
  const segments = base.map((p, k) => {
    const med = lambda * p, c = SHIFT[k];
    return { k, c: r4(c), mu: Math.log(Math.max(med - c, 0.25)), sigma, median: r2(med), refLineSeg: r2(p) };
  });
  return { id, label, kind, tier, synthetic: false, lambda: r4(lambda), sigma: r4(sigma), note, segments, skips: skipTable(tier), asRun };
}
function careerStats(prof, N, f, reps, seed) {
  const n = reach(N, f), vs = routeVariants(prof.asRun);
  let sPB = 0, sSOB = 0;
  for (let r = 0; r < reps; r++) {
    const gold = SPLITS.map(() => Infinity); let pb = Infinity;
    for (let a = 0; a < N; a++) {
      const run = r * N + a; let tot = 0;
      for (let k = 0; k < N_SPLITS && a < n[k]; k++) {
        const s = sampleSegment(prof, k, vs[k], seed, run);
        if (s.dead) break;
        if (s.t < gold[k]) gold[k] = s.t;
        tot += s.t;
        if (k === N_SPLITS - 1 && tot < pb) pb = tot;
      }
    }
    sPB += pb; sSOB += sum(gold);
  }
  return { pb: sPB / reps, sob: sSOB / reps };
}
function solveLambda(key, sigma, targetPB, opt, seed) {
  let lo = 0.8, hi = 2.0;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const st = careerStats(makeRefProfile({ id: 'x', base: refLineSegs(key), lambda: mid, sigma, asRun: AS_RUN[key] }), opt.attempts, opt.completeFrac, opt.reps, seed);
    if (st.pb > targetPB) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
export function calibrate(seed = SEED, opt = CAL) {
  const nano = REFRUN.nano701, tp = REFRUN.tp650;
  const targetGap = nano.time - opt.sob;
  let lo = 0.02, hi = 1.2;
  for (let i = 0; i < 16; i++) {
    const sg = (lo + hi) / 2;
    const lam = solveLambda('nano701', sg, nano.time, opt, seed);
    const st = careerStats(makeRefProfile({ id: 'x', base: refLineSegs('nano701'), lambda: lam, sigma: sg, asRun: AS_RUN.nano701 }), opt.attempts, opt.completeFrac, opt.reps, seed);
    if (st.pb - st.sob > targetGap) hi = sg; else lo = sg;
  }
  const sigma = (lo + hi) / 2;
  const lamNano = solveLambda('nano701', sigma, nano.time, opt, seed);
  const stN = careerStats(makeRefProfile({ id: 'x', base: refLineSegs('nano701'), lambda: lamNano, sigma, asRun: AS_RUN.nano701 }), opt.attempts, opt.completeFrac, opt.reps, seed);
  const lamTP = solveLambda('tp650', sigma, tp.time, opt, seed);
  const stT = careerStats(makeRefProfile({ id: 'x', base: refLineSegs('tp650'), lambda: lamTP, sigma, asRun: AS_RUN.tp650 }), opt.attempts, opt.completeFrac, opt.reps, seed);
  return {
    sigma: r4(sigma), attempts: opt.attempts, completeFrac: opt.completeFrac, reach: reach(opt.attempts, opt.completeFrac), reps: opt.reps,
    nanobit: { pb: nano.time, sob: opt.sob, lambda: r4(lamNano), modelPB: r2(stN.pb), modelSOB: r2(stN.sob) },
    texaspete: { pb: tp.time, lambda: r4(lamTP), modelPB: r2(stT.pb), modelSOB: r2(stT.sob), note: 'sigma pooled from Nanobit; same attempt count assumed' },
  };
}

// ---------- Normal–Inverse-Gamma shrinkage for a user's segment ----------
export const NIG_PRIOR = { kappa0: 1, nu0: 3 };
export function fitNIG(y, m0, s0, prior = NIG_PRIOR) {
  const n = y.length;
  return fitNIGStats(n, n ? mean(y) : 0, n > 1 ? (n - 1) * sd(y) ** 2 : 0, m0, s0, prior);
}
// Conjugate update from sufficient statistics: n, ybar, ss = sum of squared deviations.
export function fitNIGStats(n, yb, ss, m0, s0, { kappa0, nu0 } = NIG_PRIOR) {
  const kn = kappa0 + n, mn = (kappa0 * m0 + n * yb) / kn, nn = nu0 + n;
  const s2n = (nu0 * s0 * s0 + ss + (kappa0 * n / kn) * (yb - m0) ** 2) / nn;
  return { n, ybar: n ? yb : null, s: n > 1 ? Math.sqrt(ss / n) : null, m0, s0, kappa0, nu0, kappaN: kn, muN: mn, nuN: nn, s2N: s2n, weight: n / kn };
}
// EM for log-normal + known skip-miss mixture. Component c (a set of missed skips)
// has weight w_c = prod p_j (made) * (1-p_j)(1-fatal_j) (missed, survived), renormalised,
// and shifts the segment by L_c = sum of losses. Shared (mu, sigma) on log(t - c_k - L_c).
export function emMisses(t, c, skips, m0, s0, iters = 300) {
  const m = skips.length, combos = [];
  for (let mask = 0; mask < (1 << m); mask++) {
    let w = 1, L = 0;
    for (let j = 0; j < m; j++) { const s = skips[j]; if ((mask >> j) & 1) { w *= (1 - s.p) * (1 - s.fatal); L += s.loss; } else w *= s.p; }
    combos.push({ w, L });
  }
  const W = sum(combos.map(x => x.w)); combos.forEach(x => (x.w /= W));
  const cleanShare = combos[0].w, n = t.length;
  if (!n) return { n: 0, mu: m0, s2: s0 * s0, cleanShare, iters: 0, expectedMisses: 0 };
  const x0 = t.map(v => Math.log(Math.max(v - c, 0.25)));
  let mu = mean(x0), s2 = Math.max(n > 1 ? sd(x0) ** 2 : s0 * s0, 1e-3), it = 0, missSum = 0;
  for (; it < iters; it++) {
    let S0 = 0, S1 = 0, S2 = 0; missSum = 0;
    for (const ti of t) {
      const lp = combos.map(cb => { const x = ti - c - cb.L; if (x <= 0.05) return -Infinity; const lx = Math.log(x); return Math.log(cb.w) - lx - 0.5 * Math.log(s2) - (lx - mu) ** 2 / (2 * s2); });
      const mx = Math.max(...lp);
      if (!isFinite(mx)) { const lx = Math.log(0.25); S0 += 1; S1 += lx; S2 += lx * lx; continue; }
      const e = lp.map(v => Math.exp(v - mx)), Z0 = sum(e);
      e.forEach((ei, ci) => { const r = ei / Z0; if (!r) return; const lx = Math.log(ti - c - combos[ci].L); S0 += r; S1 += r * lx; S2 += r * lx * lx; if (ci) missSum += r; });
    }
    const nmu = S1 / S0, ns2 = Math.max(S2 / S0 - nmu * nmu, 1e-4);
    const done = Math.abs(nmu - mu) < 1e-7 && Math.abs(ns2 - s2) < 1e-7;
    mu = nmu; s2 = ns2;
    if (done) break;
  }
  return { n, mu, s2, cleanShare, iters: it, expectedMisses: missSum };
}
export function drawNIG(post, R, count = 2048) {
  const mu = new Float64Array(count), sigma = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const chi = 2 * R.gamma(post.nuN / 2);         // chi-square with nuN dof
    const s2 = post.nuN * post.s2N / chi;           // scaled-inv-chi2
    sigma[i] = Math.sqrt(s2);
    mu[i] = post.muN + Math.sqrt(s2 / post.kappaN) * R.normal();
  }
  return { mu, sigma };
}

// Fit a profile from a dw_lab_v2 export. Prior per segment = the mean of the
// calibrated record-holder log-excess (mu) and their sigma.
export function fitUserProfile(exp, refProfiles, { id = 'user', label = 'Your attempts', route = null, seed = SEED } = {}) {
  const skips = skipTable('runner', exp.logs, exp.lost);
  const asRun = route || exp.route || DEFAULT_CURRENT_ROUTE;
  const vs = routeVariants(asRun);
  const R = rng(seed ^ strHash(id));
  const segments = SPLITS.map((_, k) => {
    const c = SHIFT[k];
    const m0 = mean(refProfiles.map(p => p.segments[k].mu)), s0 = mean(refProfiles.map(p => p.segments[k].sigma));
    // Deconvolve skip misses: observed segment = clean log-normal + the loss of
    // whichever skips missed. EM over the 2^m miss combinations (known p, loss).
    // The variant's own delta is removed so the fit is on the reference line.
    const raw = [...exp.segSamples[k]].sort((a, b) => a - b);
    const em = emMisses(raw.map(t => t - vs[k].delta), c, vs[k].skips.map(sid => skips[sid]), m0, s0);
    const post = fitNIGStats(em.n, em.mu, em.n * em.s2, m0, s0);
    return {
      k, c: r4(c), mu: post.muN, sigma: Math.sqrt(post.s2N), draws: drawNIG(post, R), median: r2(c + Math.exp(post.muN)),
      nRaw: raw.length, cleanShare: r4(em.cleanShare), em: { mu: r4(em.mu), sigma: r4(Math.sqrt(em.s2)), iters: em.iters, expectedMisses: r2(em.expectedMisses) },
      nig: Object.fromEntries(Object.entries(post).map(([a, b]) => [a, r4(b)])), priorOnly: raw.length === 0, sampleMedian: raw.length ? r2(median(raw)) : null,
    };
  });
  return { id, label, kind: 'user', tier: 'runner', synthetic: !!exp.synthetic, note: exp.note, segments, skips, asRun,
    data: { attempts: exp.attempts.length, finished: exp.done.length, pb: exp.pb, practiceLogs: Object.keys(exp.logs).length } };
}

// ---------- SYNTHETIC new runner ----------
// Hidden truth: reference-line medians 7% slower than Nanobit's 7:01 splits,
// log-sd 0.30, skip rates of someone a few weeks in, running today's default
// route (Sanctum flight). Generates an export in the app's dw_lab_v2 format.
export const SYNTH_TRUTH = {
  paceFactor: 1.07, sigma: 0.30, attempts: 80, practicePerSplit: 6,
  p: { 's-airvent': 0.95, 's-soul': 0.85, 's-bd1': 0.85, 's-necro': 0.7, 'x-vines-direct': 0.3, 's-vines-old': 0.3, 's-poison': 0.85, 's-demon': 0.85, 's-thane': 0.65, 'x-thane-launch': 0.3, 's-parkour': 0.85, 's-keep': 0.55, 's-kuldra': 0.5, 's-flight': 0.45, 's-heart': 0.8 },
  reps: { 's-airvent': 15, 's-soul': 20, 's-bd1': 15, 's-necro': 30, 'x-vines-direct': 6, 's-poison': 15, 's-demon': 20, 's-thane': 40, 'x-thane-launch': 8, 's-parkour': 15, 's-keep': 25, 's-kuldra': 8, 's-flight': 20, 's-heart': 10 },
  route: DEFAULT_CURRENT_ROUTE, resetIfBehind: 1.06,
};
export function syntheticExport(seed = SEED) {
  const T = SYNTH_TRUTH;
  const truth = makeRefProfile({ id: 'truth', base: refLineSegs('nano701'), lambda: T.paceFactor, sigma: T.sigma, asRun: T.route });
  for (const [id, p] of Object.entries(T.p)) if (truth.skips[id]) truth.skips[id].p = p;
  const vs = routeVariants(T.route), R = rng(seed ^ 0x5157);
  const pace = []; let acc = 0; vs.forEach((v, k) => { acc += truth.segments[k].median + v.delta; pace.push(acc); });
  const t0 = Date.parse('2026-10-20T18:00:00Z');
  const attempts = [];
  for (let a = 0; a < T.attempts; a++) {
    const splits = [null, null, null, null, null]; let cum = 0, done = true;
    for (let k = 0; k < N_SPLITS; k++) {
      const s = sampleSegment(truth, k, vs[k], seed ^ 0xA77E, a);
      if (s.dead) { done = false; break; }
      cum += s.t; splits[k] = +cum.toFixed(2);
      if (k < N_SPLITS - 1 && cum > pace[k] * T.resetIfBehind) { done = false; break; }
    }
    attempts.push({ at: t0 + a * 9 * 60000, splits, time: done ? splits[N_SPLITS - 1] : null, done });
  }
  const segPractice = {};
  for (let k = 0; k < N_SPLITS; k++) segPractice[k] = Array.from({ length: T.practicePerSplit }, (_, i) => ({ t: +sampleSegment(truth, k, vs[k], seed ^ 0x9A9A, 1000 * (k + 1) + i).t.toFixed(2), at: t0 + i * 60000 }));
  const practice = {};
  for (const [id, n] of Object.entries(T.reps)) practice[id] = { log: Array.from({ length: n }, (_, i) => ({ t: t0 + i * 30000, ok: R() < T.p[id] })) };
  const done = attempts.filter(a => a.done);
  const pbA = done.reduce((b, a) => (!b || a.time < b.time ? a : b), null);
  return {
    _synthetic: true,
    _note: 'SYNTHETIC — generated by scripts/analysis/model.mjs to exercise the user-data path. Not a real runner. Hidden truth in _truth.',
    _truth: { paceFactor: T.paceFactor, sigma: T.sigma, p: T.p, route: T.route, referenceLineMedians: truth.segments.map(s => s.median) },
    version: 2, analysisRoute: T.route, segPractice, practice,
    timer: { pb: pbA ? { splits: pbA.splits, time: pbA.time, at: pbA.at } : null, best: [], attempts, comparison: 'tp650', runs: done.length, resets: attempts.length - done.length, imported: null },
  };
}

// Practice levers measured in runpath.json: Nanobit's own pinned "time lost here"
// notes and the target-pace margin on the Sanctum flight line.
export function pinnedSaves() {
  if (!RPD) return [];
  // The heart safespot note is a skip miss (s-heart), already modelled, so it is not a pace lever.
  const out = (RPD.nanobit_pinned_saves || []).filter(x => x.est_s > 0 && !/safespot/i.test(x.note)).map(x => ({ piece: x.seg, split: pieceSplit(x.seg), seconds: x.est_s, note: x.note, ts: x.video_ts, source: 'Nanobit pinned note (runpath.json)' }));
  const tgt = (RPD.target && RPD.target.per_segment || []).find(x => x.seg === 'C11->C12');
  const best = piece('C11->C12', 'dotxy');
  if (tgt && best != null && best > tgt.target) out.push({ piece: 'C11->C12', split: pieceSplit('C11->C12'), seconds: r2(best - tgt.target), note: 'flight line tighter than Dotxy\'s demo (no landing/walk on the walkway)', ts: null, source: 'runpath target', requires: 'sanctum-flight' });
  return out;
}

// ---------- build everything ----------
export function buildModel({ user = null, seed = SEED, calibration = null } = {}) {
  const cal = calibration || calibrate(seed);
  const nanoBase = refLineSegs('nano701'), tpBase = refLineSegs('tp650');
  const profiles = [
    makeRefProfile({ id: 'tp650', label: 'TexasPete (calibrated: 6:50 = best of ~177 attempts)', base: tpBase, lambda: cal.texaspete.lambda, sigma: cal.sigma, asRun: AS_RUN.tp650, note: 'Medians slower than the PB splits because a PB is a best-of-N outlier. Splits moved onto the reference line (his Vines/Thane/Keep/Sanctum lines differ).' }),
    makeRefProfile({ id: 'nano701', label: 'Nanobit (calibrated to PB 7:01.97 and SOB 6:51)', base: nanoBase, lambda: cal.nanobit.lambda, sigma: cal.sigma, asRun: AS_RUN.nano701 }),
    makeRefProfile({ id: 'tp650-asmedian', label: 'TexasPete 6:50 as a typical run (optimistic lens)', base: tpBase, lambda: 1, sigma: cal.sigma, asRun: AS_RUN.tp650, kind: 'lens', note: 'Treats the record run as the median attempt — an upper bound.' }),
    makeRefProfile({ id: 'nano701-asmedian', label: 'Nanobit 7:01 as a typical run (optimistic lens)', base: nanoBase, lambda: 1, sigma: cal.sigma, asRun: AS_RUN.nano701, kind: 'lens' }),
    makeRefProfile({ id: 'target-asmedian', label: 'Runpath target pace 6:48.1 as a typical clean run (lens)', base: segsOf(targetPace()).map((x, k) => x - VARIANT[TARGET_ROUTE[k]].delta), lambda: 1, sigma: cal.sigma, asRun: TARGET_ROUTE, kind: 'lens', note: 'A runner whose median clean run is the target pace; misses come on top.' }),
    makeRefProfile({ id: 'best-of-both-asmedian', label: 'Best of TexasPete/Nanobit per split on the reference line, as a typical run (ceiling lens)', base: nanoBase.map((x, k) => Math.min(x, tpBase[k])), lambda: 1, sigma: cal.sigma, asRun: AS_RUN.nano701, kind: 'lens' }),
  ];
  const refs = profiles.filter(p => p.kind === 'reference');
  const synthExp = syntheticExport(seed);
  const synth = { ...fitUserProfile(parseExport(synthExp), refs, { id: 'synthetic-new', label: 'SYNTHETIC new runner (generated, not real data)', seed }), synthetic: true };
  // Recovery check: fitted reference-line medians vs the hidden truth.
  synth.recovery = synth.segments.map((s, k) => ({ k, truthMedian: synthExp._truth.referenceLineMedians[k], fittedMedian: s.median, truthSigma: SYNTH_TRUTH.sigma, fittedSigma: r4(s.sigma) }));
  profiles.push(synth);
  if (user) profiles.push(fitUserProfile(parseExport(readJSON(user)), refs, { id: 'user', label: `Your attempts (${user})`, seed }));
  return {
    meta: { goal: GOAL, goalMargin: GOAL_MARGIN, shiftFrac: SHIFT_FRAC, seed, splits: SPLITS.map(s => s.short), runpath: RP ? { path: RP.path, error: RP.error || null } : { found: false, searched: RUNPATH_PATHS, note: 'assumed variant deltas in use' }, user: user || null },
    reference: REF.map(r => ({ ...r, refLineSegs: AS_RUN[r.key] ? refLineSegs(r.key).map(r2) : null })), communityBest: BEST.map(b => ({ seg: r2(b.seg), run: b.run, runner: b.runner })), shift: SHIFT.map(r2),
    measured: MEAS, calibration: cal, variants: VARIANTS, asRun: AS_RUN, defaultRoute: DEFAULT_CURRENT_ROUTE, miss: MISS, statusPrior: STATUS_PRIOR, nigPrior: NIG_PRIOR, pinnedSaves: pinnedSaves(),
    profiles, synthExport: synthExp,
  };
}

// Reuse the calibration stored in model.json (same seed + runpath) unless --recalibrate.
export function getModel({ user = null, seed = SEED, recalibrate = false } = {}) {
  let calibration = null;
  try {
    const m = readJSON(join(OUT_DIR, 'model.json'));
    if (!recalibrate && m.meta && m.meta.seed === seed && (m.meta.runpath || {}).path === (RP ? RP.path : undefined)) calibration = m.calibration;
  } catch { /* no cached model yet */ }
  return buildModel({ user, seed, calibration });
}

// JSON form of a profile (draw arrays are regenerated from the NIG posterior; not stored).
export const profileJSON = p => ({ ...p, segments: p.segments.map(({ draws, ...s }) => ({ ...s, mu: r4(s.mu), sigma: r4(s.sigma), drawsFromPosterior: !!draws })) });

if (isMain(import.meta.url)) {
  const a = args();
  const t0 = Date.now();
  const m = buildModel({ user: a.user || null, seed: a.seed ? +a.seed : SEED });
  writeJSON(join(OUT_DIR, 'synthetic-new-runner.export.json'), m.synthExport);
  writeJSON(join(OUT_DIR, 'model.json'), { ...m, profiles: m.profiles.map(profileJSON), synthExport: undefined, generatedAt: new Date().toISOString() });
  console.log(`model: sigma=${m.calibration.sigma} lambdaTP=${m.calibration.texaspete.lambda} lambdaNano=${m.calibration.nanobit.lambda} (${Date.now() - t0} ms); runpath ${RP ? RP.path : 'absent'}`);
  for (const [k, v] of Object.entries(MEAS)) if (v && v.v != null) console.log(`  ${k.padEnd(12)} ${String(v.v).padStart(7)}  ${v.src}`);
  for (const p of m.profiles) console.log(`  ${p.id.padEnd(22)} ref-line medians ${p.segments.map(s => s.median).join(' / ')}  sum ${fmt(sum(p.segments.map(s => s.median)))}`);
}
