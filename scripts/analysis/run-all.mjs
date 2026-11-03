// run-all.mjs — rebuild every analysis output, then verify that each JSON parses
// and each CSV is rectangular.
//
//   node scripts/analysis/run-all.mjs [--user export.json] [--n 100000] [--recalibrate]
//
// Order: model (calibration, profiles) → stats → simulate → optimize → docs.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { args, isMain, OUT_DIR, DOCS_DIR, ROOT } from './lib.mjs';

export function verifyOutputs(dir = OUT_DIR) {
  const report = [];
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f), txt = readFileSync(p, 'utf8');
    if (f.endsWith('.json')) {
      try { JSON.parse(txt); report.push({ file: f, ok: true, bytes: statSync(p).size }); } catch (e) { report.push({ file: f, ok: false, error: e.message }); }
    } else if (f.endsWith('.csv')) {
      // Count columns with a quote-aware split; every row must match the header.
      const rows = txt.trimEnd().split('\n').map(l => { let n = 1, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) n++; } return n; });
      const bad = rows.findIndex(n => n !== rows[0]);
      report.push({ file: f, ok: bad < 0, rows: rows.length - 1, cols: rows[0], ...(bad >= 0 ? { error: `row ${bad} has ${rows[bad]} columns` } : {}) });
    }
  }
  return report;
}

if (isMain(import.meta.url)) {
  const a = args();
  const pass = [...(a.user ? ['--user', a.user] : []), ...(a.recalibrate ? ['--recalibrate'] : [])];
  const n = a.n ? ['--n', String(a.n)] : [];
  const steps = [['model.mjs', a.user ? ['--user', a.user] : []], ['stats.mjs', pass], ['simulate.mjs', [...pass, ...n]], ['optimize.mjs', [...pass, ...n]], ['docs.mjs', []]];
  for (const [s, extra] of steps) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'analysis', s), ...extra], { stdio: 'inherit', cwd: ROOT });
    console.log(`== ${s} exit ${r.status} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (r.status !== 0) process.exit(r.status || 1);
  }
  const rep = verifyOutputs();
  for (const x of rep) console.log(`${x.ok ? 'ok ' : 'BAD'} ${x.file}${x.rows != null ? ` (${x.rows} rows × ${x.cols} cols)` : ''}${x.error ? ' — ' + x.error : ''}`);
  const docs = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  console.log(`docs/math: ${docs.join(', ')}`);
  if (rep.some(x => !x.ok)) process.exit(1);
}
