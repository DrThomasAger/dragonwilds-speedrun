// stats.mjs — spreadsheet tables: segment stats across all runs, consistency,
// "time on the table" per split, sum of best / composite, speedrun.com runs,
// your attempts (from a dw_lab_v2 export), skip-level marks from runpath.json.
//
//   node scripts/analysis/stats.mjs [--user export.json] [--runpath path]
//
// Writes data/kb/analysis/stats.json and *.csv next to it.
import { join } from 'node:path';
import { SPLITS, targetPace, TARGET_TIME } from '../../js/data/raid.js';
import { REF, BEST, GOAL, VARIANT, N_SPLITS, segsOf, parseExport, RP, pieceSplit, getModel, sampleSegment, SEED, DEFAULT_CURRENT_ROUTE, SYNTH_TRUTH } from './model.mjs';
import { mean, sd, median, quantileSorted, sum, r2, r4, fmt, readJSON, readJSONL, writeJSON, writeCSV, args, isMain, OUT_DIR, ROOT } from './lib.mjs';

const NAMES = SPLITS.map(s => s.short);
const RECORD_KEYS = ['tp650', 'nano701', 'tp740'];

export function referenceTables() {
  const pace = targetPace(), paceSegs = segsOf(pace);
  const runs = REF.map(r => ({ run: r.key, runner: r.runner, label: r.label, patch: r.patch, total: r.time, ...Object.fromEntries(r.segs.map((s, k) => [NAMES[k], r2(s)])) }));
  runs.push({ run: 'community-best', runner: 'composite', label: 'Best segment per split (sum of best)', total: r2(sum(BEST.map(b => b.seg))), ...Object.fromEntries(BEST.map((b, k) => [NAMES[k], r2(b.seg)])) });
  runs.push({ run: 'target-pace', runner: 'target', label: `Target pace ${fmt(TARGET_TIME)} (community best scaled)`, total: TARGET_TIME, ...Object.fromEntries(paceSegs.map((s, k) => [NAMES[k], r2(s)])) });

  const segStats = SPLITS.map((sp, k) => {
    const all = REF.map(r => r.segs[k]), rec = REF.filter(r => RECORD_KEYS.includes(r.key)).map(r => r.segs[k]);
    const s = [...all].sort((a, b) => a - b), m = mean(all), d = sd(all);
    return { split: k + 1, name: sp.name, n: all.length, mean: r2(m), median: r2(median(all)), best: r2(s[0]), bestRun: BEST[k].run, worst: r2(s[s.length - 1]), sd: r2(d), cv: r4(d / m),
      recordMean: r2(mean(rec)), recordSd: r2(sd(rec)), recordCv: r4(sd(rec) / mean(rec)), targetPaceSeg: r2(paceSegs[k]), shareOfBestTotal: r4(BEST[k].seg / sum(BEST.map(b => b.seg))) };
  });

  // Time on the table: each run's loss to the community best, per split, and what
  // the run would need to cut to hit target pace.
  const gaps = REF.map(r => {
    const row = { run: r.key, runner: r.runner, total: r.time };
    r.segs.forEach((s, k) => { row[`${NAMES[k]}_vsBest`] = r2(s - BEST[k].seg); row[`${NAMES[k]}_vsPace`] = r2(s - paceSegs[k]); });
    row.onTableVsBest = r2(r.time - sum(BEST.map(b => b.seg)));
    row.needToBeat650 = r2(Math.max(0, r.time - (GOAL - 0.01)));
    row.biggestLeak = NAMES[r.segs.map((s, k) => s - BEST[k].seg).reduce((bi, x, i, a) => (x > a[bi] ? i : bi), 0)];
    return row;
  });
  // Split-level table: on-the-table across the record runs (mean loss to best).
  const onTable = SPLITS.map((sp, k) => {
    const rec = REF.filter(r => RECORD_KEYS.includes(r.key));
    const loss = rec.map(r => r.segs[k] - BEST[k].seg);
    return { split: k + 1, name: sp.name, communityBest: r2(BEST[k].seg), bestBy: BEST[k].runner, tp650Loss: r2(REF[0].segs[k] - BEST[k].seg), nano701Loss: r2(REF[1].segs[k] - BEST[k].seg), recordMeanLoss: r2(mean(loss)), targetPaceSeg: r2(paceSegs[k]), targetSlack: r2(paceSegs[k] - BEST[k].seg) };
  });

  // Variance decomposition across reference runs: share of total-time variance per split.
  const cov = (a, b) => { const ma = mean(a), mb = mean(b); return sum(a.map((x, i) => (x - ma) * (b[i] - mb))) / (a.length - 1); };
  const totals = REF.map(r => r.time);
  const varTot = sd(totals) ** 2;
  const consistency = SPLITS.map((sp, k) => {
    const x = REF.map(r => r.segs[k]);
    const recX = REF.filter(r => RECORD_KEYS.includes(r.key)).map(r => r.segs[k]);
    return { split: k + 1, name: sp.name, sdAllRuns: r2(sd(x)), cvAllRuns: r4(sd(x) / mean(x)), sdRecordRuns: r2(sd(recX)), shareOfTotalVariance: r4(cov(x, totals) / varTot),
      texasPete650vs740: r2(REF.find(r => r.key === 'tp740').segs[k] - REF[0].segs[k]), ratioToNanobit: REF.map(r => r2(r.segs[k] / REF[1].segs[k])).join(' ') };
  });

  // Composites / sum of best.
  const composite = {
    communitySumOfBest: r2(sum(BEST.map(b => b.seg))), bestSegments: BEST.map((b, k) => ({ split: NAMES[k], seg: r2(b.seg), runner: b.runner, run: b.run })),
    recordComposite: (() => { const two = REF.filter(r => ['tp650', 'nano701'].includes(r.key)); const segs = SPLITS.map((_, k) => Math.min(...two.map(r => r.segs[k]))); return { runs: ['tp650', 'nano701'], segs: segs.map(r2), total: r2(sum(segs)), underGoalBy: r2(GOAL - sum(segs)) }; })(),
    nanobitStatedSumOfBest: 411, nanobitPB: REF[1].time, nanobitPbMinusSob: r2(REF[1].time - 411),
    targetPace: { total: TARGET_TIME, cumulative: pace.map(r2), scale: r4(TARGET_TIME / sum(BEST.map(b => b.seg))) },
  };
  return { runs, segStats, gaps, onTable, consistency, composite };
}

export function sourceRuns() {
  const src = readJSON(join(ROOT, 'data', 'sources.json'), { items: {} });
  const log = readJSONL(join(ROOT, 'data', 'sources-log.jsonl'));
  const rows = Object.values(src.items || {}).filter(i => i.kind === 'run').map(i => ({ runner: (i.title || '').split(' ')[0], title: i.title, status: i.status, time: i.time, timeFmt: fmt(i.time), date: i.date, bracket: i.bracket, vs650: i.time != null ? r2(i.time - GOAL) : null, beats650: i.time != null && i.time < GOAL, url: i.url }));
  rows.sort((a, b) => (a.bracket === b.bracket ? a.time - b.time : a.bracket < b.bracket ? -1 : 1));
  const byRunner = {};
  for (const r of rows.filter(r => r.bracket === '1.0.0.6+')) (byRunner[r.runner] ||= []).push(r.time);
  const runners = Object.entries(byRunner).map(([runner, t]) => ({ runner, runs: t.length, best: Math.min(...t), mean: r2(mean(t)), sd: r2(sd(t)), spread: r2(Math.max(...t) - Math.min(...t)) }));
  return { checkedAt: src.checkedAt, rows, runners, logEvents: log.length, logKinds: log.reduce((o, e) => ((o[e.event] = (o[e.event] || 0) + 1), o), {}) };
}

export function attemptTables(exp, label) {
  const n = exp.attempts.length;
  const reach = SPLITS.map((_, k) => exp.attempts.filter(a => a.splits[k] != null).length);
  const segRows = SPLITS.map((sp, k) => {
    const a = exp.fromAttempts[k], p = exp.fromPractice[k], all = [...a, ...p].sort((x, y) => x - y);
    return { profile: label, split: k + 1, name: sp.name, reached: reach[k], reachRate: n ? r4(reach[k] / n) : null, nRun: a.length, nPractice: p.length, gold: r2(all[0]), p10: r2(quantileSorted(all, 0.1)), median: r2(quantileSorted(all, 0.5)), mean: r2(mean(all)), sd: r2(sd(all)), vsCommunityBest: all.length ? r2(all[0] - BEST[k].seg) : null, medianVsBest: all.length ? r2(quantileSorted(all, 0.5) - BEST[k].seg) : null };
  });
  const golds = segRows.map(r => r.gold);
  const skipRows = Object.entries(exp.logs).map(([id, log]) => { const made = log.filter(x => x.ok).length; const last20 = log.slice(-20); return { profile: label, skip: id, attempts: log.length, made, missed: log.length - made, betaMean: r4((1 + made) / (2 + log.length)), last20Rate: r4(last20.filter(x => x.ok).length / (last20.length || 1)) }; });
  return { label, synthetic: exp.synthetic, attempts: n, finished: exp.done.length, pb: exp.pb, sumOfBest: golds.every(g => g != null) ? r2(sum(golds)) : null, medianFinish: exp.done.length ? r2(median(exp.done)) : null, segRows, skipRows };
}

// Model-based consistency: per profile and split, the simulated segment
// distribution under the default current-patch line (clean spread + misses).
export function modelConsistency(model, n = 20000) {
  const rows = [];
  for (const p of model.profiles) {
    const route = p.kind === 'user' ? p.asRun : DEFAULT_CURRENT_ROUTE;
    route.forEach((vid, k) => {
      const v = VARIANT[vid], t = []; let miss = 0, dead = 0;
      for (let i = 0; i < n; i++) { const s = sampleSegment(p, k, v, SEED ^ 0xC0, i); if (s.dead) { dead++; continue; } t.push(s.t); if (s.misses) miss++; }
      t.sort((a, b) => a - b);
      rows.push({ profile: p.id, synthetic: !!p.synthetic, split: k + 1, name: NAMES[k], variant: vid, cleanMedian: r2(p.segments[k].c + Math.exp(p.segments[k].mu) + v.delta), p10: r2(quantileSorted(t, 0.1)), median: r2(quantileSorted(t, 0.5)), p90: r2(quantileSorted(t, 0.9)), mean: r2(mean(t)), sd: r2(sd(t)), pAnyMiss: r4(miss / n), pDeath: r4(dead / n) });
    });
  }
  return rows;
}

// Piece-level table from runpath.json: every checkpoint-to-checkpoint piece, each
// run's duration (P = patched, U = unverified), best valid piece, target, slack.
export function runpathTable() {
  const d = RP && RP.data;
  if (!d || !d.segments) return [];
  const tgt = Object.fromEntries(((d.target || {}).per_segment || []).map(x => [x.seg, x.target]));
  const runs = [...new Set(d.segments.flatMap(x => Object.keys(x.runs)))];
  return d.segments.map(x => {
    const row = { piece: x.seg, split: (pieceSplit(x.seg) ?? -1) + 1, from: x.from, to: x.to };
    for (const r of runs) { const v = x.runs[r]; row[r] = v ? v.dur : null; row[r + '_flag'] = v ? (v.patched ? 'P' : '') + (v.unverified ? 'U' : '') : null; }
    row.bestValidRun = x.best_valid ? x.best_valid[0] : null; row.bestValid = x.best_valid ? x.best_valid[1] : null;
    row.target = tgt[x.seg] ?? null; row.targetVsBestValid = row.target != null && row.bestValid != null ? r2(row.target - row.bestValid) : null;
    return row;
  });
}

if (isMain(import.meta.url)) {
  const a = args();
  const ref = referenceTables(), src = sourceRuns();
  const model = getModel({ user: a.user || null, recalibrate: !!a.recalibrate });
  const att = [attemptTables(parseExport(model.synthExport), 'synthetic-new (SYNTHETIC)')];
  if (a.user) att.push(attemptTables(parseExport(readJSON(a.user)), 'user'));
  const cons = modelConsistency(model);
  const rp = runpathTable();
  // Valid-on-1.0.1.2 composite per split (sum of the best valid piece in each split).
  if (rp.length) ref.onTable.forEach((row, k) => { const ps = rp.filter(x => x.split === k + 1); row.validComposite = r2(sum(ps.map(x => x.bestValid))); row.validTarget = r2(sum(ps.map(x => x.target ?? x.bestValid))); });
  const out = { generatedAt: new Date().toISOString(), goal: GOAL, splits: NAMES, ...ref, sources: src, attempts: att, modelConsistency: cons, runpathPieces: rp, runpathTotals: RP && RP.data ? RP.data.totals : null, synthTruth: SYNTH_TRUTH };
  writeJSON(join(OUT_DIR, 'stats.json'), out);
  writeCSV(join(OUT_DIR, 'segments.csv'), ref.runs);
  writeCSV(join(OUT_DIR, 'segment-stats.csv'), ref.segStats);
  writeCSV(join(OUT_DIR, 'time-on-table.csv'), ref.onTable);
  writeCSV(join(OUT_DIR, 'gaps-by-run.csv'), ref.gaps);
  writeCSV(join(OUT_DIR, 'consistency.csv'), ref.consistency);
  writeCSV(join(OUT_DIR, 'model-consistency.csv'), cons);
  writeCSV(join(OUT_DIR, 'sources-runs.csv'), src.rows);
  writeCSV(join(OUT_DIR, 'attempt-segments.csv'), att.flatMap(x => x.segRows));
  writeCSV(join(OUT_DIR, 'skip-practice.csv'), att.flatMap(x => x.skipRows));
  if (rp.length) writeCSV(join(OUT_DIR, 'runpath-pieces.csv'), rp);
  console.log(`stats: ${ref.runs.length} run rows, community SOB ${fmt(ref.composite.communitySumOfBest)}, record composite ${fmt(ref.composite.recordComposite.total)}, ${src.rows.length} speedrun.com runs, runpath marks ${rp.length}`);
  console.table(ref.onTable);
}
