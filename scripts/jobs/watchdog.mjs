// "Sangha Bridge Watchdog" (every 10 min): restarts the two local servers if they are down.
//   127.0.0.1:5180  `bb lab` in dragonwilds-speedrun        -> D:\claude-temp\logs\bridge.log
//   127.0.0.1:5555  `python server.py` in SmilePrompt gui   -> D:\claude-temp\logs\osrs-gui.log
// Log: D:\claude-temp\logs\watchdog-<date>.log
import { existsSync } from 'node:fs';
import { logger, listening, startDetached, ROOT, LOGDIR } from './lib.mjs';

const GUI = 'D:\\labyrinth\\Github\\SmilePrompt\\Composer\\osrs\\gui';
const L = logger('watchdog');
const SERVICES = [
  { port: 5180, name: 'bb lab bridge', cwd: ROOT, cmd: 'bb', args: ['lab'], log: `${LOGDIR}/bridge.log` },
  { port: 5555, name: 'osrs gui server.py', cwd: GUI, cmd: 'python', args: ['server.py'], log: `${LOGDIR}/osrs-gui.log`, need: `${GUI}\\server.py` },
];
const status = [];
for (const s of SERVICES) {
  if (await listening(s.port)) { status.push(`${s.port} up`); continue; }
  if (s.need && !existsSync(s.need)) { L.say(`${s.name}: ${s.need} missing, not started`); continue; }
  const pid = startDetached(s.cmd, s.args, { cwd: s.cwd, log: s.log });
  L.say(`${s.name}: nothing on ${s.port}, started (pid ${pid}), output -> ${s.log}`);
  status.push(`${s.port} started`);
}
L.say('check: ' + status.join(', '));
process.exit(0);
