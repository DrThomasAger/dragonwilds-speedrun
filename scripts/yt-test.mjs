// Cross-platform: run only the @youtube tests (they are excluded by default).
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['playwright', 'test', '--grep', '@youtube', ...process.argv.slice(2)], { stdio: 'inherit', shell: true, env: { ...process.env, YT: '1' } });
process.exit(r.status ?? 1);
