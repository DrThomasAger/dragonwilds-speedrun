// "RuneLite Capture" (at logon + hourly): runs capture-runelite.ps1 hidden.
// Log: D:\claude-temp\logs\runelite-capture-<date>.log
import { logger, step, ROOT } from './lib.mjs';

const L = logger('runelite-capture');
const { ok } = step(L, 'capture', 'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', `${ROOT}\\scripts\\jobs\\capture-runelite.ps1`],
  { timeout: 2 * 60 * 1000 });
process.exit(ok ? 0 : 1);
