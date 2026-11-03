// Live Twitch chat monitor (local only). Joins the raid runners' channels anonymously
// (nick justinfan12345, no token) and appends every chat line to
// data/kb/raw/twitch/live-<channel>.jsonl as {at,user,text} while it runs.
//   node scripts/ingest/twitch-live.mjs                 (channels from data/kb/raw/twitch/channels.json)
//   node scripts/ingest/twitch-live.mjs inanobit heartlessedly
// Uses wss://irc-ws.chat.twitch.tv (global WebSocket, Node >= 22 or --experimental-websocket);
// on older Node it falls back to plain IRC over TLS (irc.chat.twitch.tv:6697). Same protocol.
// Reconnects with backoff. Ctrl+C to stop.
import path from 'node:path';
import tls from 'node:tls';
import { appendFile, mkdir } from 'node:fs/promises';
import { RAW, RUNNERS, readJson } from './lib.mjs';

const DIR = path.join(RAW, 'twitch');
const NICK = 'justinfan12345';

let chans = process.argv.slice(2).filter(a => !a.startsWith('--')).map(s => s.toLowerCase().replace(/^#/, ''));
if (!chans.length) {
  const c = await readJson(path.join(DIR, 'channels.json'), { channels: [] });
  chans = c.channels.map(x => x.login);
  if (!chans.length) chans = RUNNERS.map(r => r.toLowerCase());
}
await mkdir(DIR, { recursive: true });
console.log(`twitch-live: watching ${chans.map(c => '#' + c).join(' ')} -> ${DIR}\\live-<channel>.jsonl`);

const counts = Object.fromEntries(chans.map(c => [c, 0]));
async function onLine(line, send) {
  if (line.startsWith('PING')) return send('PONG :tmi.twitch.tv');
  // @tags :user!user@user.tmi.twitch.tv PRIVMSG #chan :text
  const m = line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #(\w+) :(.*)$/);
  if (!m) return;
  const tags = Object.fromEntries((m[1] || '').split(';').map(kv => kv.split('=')));
  const rec = { at: new Date(+tags['tmi-sent-ts'] || Date.now()).toISOString(), user: tags['display-name'] || m[2], text: m[4] };
  counts[m[3]] = (counts[m[3]] || 0) + 1;
  await appendFile(path.join(DIR, `live-${m[3]}.jsonl`), JSON.stringify(rec) + '\n');
}
const hello = send => { send('CAP REQ :twitch.tv/tags'); send('PASS SCHMOOPIIE'); send(`NICK ${NICK}`); for (const c of chans) send(`JOIN #${c}`); };

let backoff = 1000;
function connect() {
  const retry = why => { console.error(`twitch-live: ${why}; reconnecting in ${backoff / 1000}s`); setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 60000); };
  if (typeof WebSocket === 'function') {
    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    const send = s => ws.send(s);
    ws.onopen = () => { backoff = 1000; hello(send); console.log('twitch-live: connected (wss)'); };
    ws.onmessage = ev => String(ev.data).split('\r\n').filter(Boolean).forEach(l => onLine(l, send));
    ws.onclose = () => retry('closed');
    ws.onerror = e => console.error('twitch-live: ws error', e.message || '');
  } else {
    const sock = tls.connect(6697, 'irc.chat.twitch.tv', { servername: 'irc.chat.twitch.tv' });
    const send = s => sock.write(s + '\r\n');
    let buf = '';
    sock.on('secureConnect', () => { backoff = 1000; hello(send); console.log('twitch-live: connected (irc/tls; no global WebSocket on this Node)'); });
    sock.on('data', d => { buf += d; const lines = buf.split('\r\n'); buf = lines.pop(); lines.forEach(l => onLine(l, send)); });
    sock.on('close', () => retry('closed'));
    sock.on('error', e => console.error('twitch-live: socket error', e.message));
  }
}
connect();
setInterval(() => console.log('twitch-live:', new Date().toISOString(), JSON.stringify(counts)), 10 * 60 * 1000).unref?.();
process.on('SIGINT', () => { console.log('twitch-live: stopped', JSON.stringify(counts)); process.exit(0); });
