// "Sangha Health" (every 30 min): disk space, last result of every job, ports 5180/5555.
// Appends one line to D:\claude-temp\logs\health.log, writes D:\claude-temp\logs\health.json.
import { statfsSync, appendFileSync, writeFileSync } from 'node:fs';
import { listening, run, LOGDIR } from './lib.mjs';

export const TASKS = ['RaidLab Hourly', 'RaidLab Logon', 'RaidLab Transcripts', 'RaidLab Daily Review', 'SMILE Arena Build',
  'Sangha Bridge Watchdog', 'Sangha Health', 'RuneLite Capture'];

const gb = d => { try { const s = statfsSync(d); return +((s.bavail * s.bsize) / 1e9).toFixed(1); } catch { return null; } };
const csvRow = line => (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));

const tasks = {};
for (const name of TASKS) {
  const r = run('schtasks', ['/Query', '/TN', name, '/V', '/FO', 'CSV'], { timeout: 30000 });
  if (r.status !== 0) { tasks[name] = { exists: false }; continue; }
  const [head, row] = r.stdout.trim().split(/\r?\n/).map(csvRow);
  const get = k => row[head.indexOf(k)];
  tasks[name] = { exists: true, status: get('Status'), lastRun: get('Last Run Time'), lastResult: get('Last Result'),
    nextRun: get('Next Run Time'), state: get('Scheduled Task State') };
}
const snap = {
  at: new Date().toISOString(),
  freeGB: { C: gb('C:\\'), D: gb('D:\\') },
  ports: { 5180: await listening(5180), 5555: await listening(5555) },
  tasks,
};
writeFileSync(`${LOGDIR}/health.json`, JSON.stringify(snap, null, 1) + '\n');
const t = Object.entries(tasks).map(([n, v]) => `${n}=${v.exists ? v.lastResult : 'missing'}`).join('; ');
appendFileSync(`${LOGDIR}/health.log`,
  `[${snap.at}] C:${snap.freeGB.C}GB D:${snap.freeGB.D}GB free | 5180 ${snap.ports[5180] ? 'up' : 'DOWN'} 5555 ${snap.ports[5555] ? 'up' : 'DOWN'} | ${t}\n`);
process.exit(0);
