// Claude panel + live feed. Active only when the app is served by the local bridge
// (`bb lab`, scripts/bridge.clj). On the public site this module does nothing.
import { h, fill, $, isTyping, toast } from './util.js';
import * as voice from './speak.js';

let live = false, es = null, panel = null, busy = false, cur = null;
const S = { open: false, tab: 'chat', log: [] };
try { Object.assign(S, JSON.parse(sessionStorage.getItem('dw_claude_panel') || '{}')); } catch { /* none */ }
const keep = () => { try { sessionStorage.setItem('dw_claude_panel', JSON.stringify({ open: S.open, tab: S.tab, log: S.log.slice(-80) })); } catch { /* blocked */ } };

// Views call this for anything worth telling Claude about (splits, PBs, practice).
export function emit(type, text, data = {}) {
  window.dispatchEvent(new CustomEvent('dw:event', { detail: { type, text, ...data } }));
}
window.addEventListener('dw:event', e => {
  if (!live) return;
  fetch('api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ view: viewName(), ...e.detail }) }).catch(() => {});
});
const viewName = () => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'hq');

export async function initBridge(slot) {
  try {
    const r = await fetch('api/status', { cache: 'no-store' });
    if (!r.ok) return;
    const st = await r.json();
    if (!st.bridge) return;
    live = true;
  } catch { return; }
  document.body.classList.add('bridge');
  const btn = h('button', { class: 'iconbtn claude-btn', title: 'Claude (Ctrl+J)', 'aria-label': 'Open Claude panel', onclick: () => toggle() }, '✦');
  slot.append(btn);
  build();
  connect();
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); toggle(); } });
  if (S.open) toggle(true);
}

function toggle(force) {
  S.open = force ?? !S.open; keep();
  document.body.classList.toggle('panel-open', S.open);
  panel.hidden = !S.open;
  if (S.open && S.tab === 'chat') setTimeout(() => panel.querySelector('textarea')?.focus(), 30);
}

// ------------------------------------------------------------------ UI
const el = {};
function build() {
  el.status = h('span', { class: 'cp-status' }, 'connecting…');
  el.tabs = h('div', { class: 'seg-ctl cp-tabs', role: 'tablist' });
  el.chat = h('div', { class: 'cp-log', 'aria-live': 'polite' });
  el.feed = h('div', { class: 'cp-feed' });
  el.snap = h('pre', { class: 'cp-snap' });
  el.input = h('textarea', { rows: 3, placeholder: 'Ask Claude, or tell it what to change in the app…', 'aria-label': 'Message Claude',
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } e.stopPropagation(); } });
  el.send = h('button', { class: 'btn pri', onclick: () => send() }, 'Send');
  el.stop = h('button', { class: 'btn', hidden: true, onclick: () => fetch('api/claude/stop', { method: 'POST' }) }, 'Stop');
  el.code = h('textarea', { rows: 6, class: 'mono', 'aria-label': 'Clojure code', placeholder: '(+ 1 2)\n\n;; runs inside the RuneLite client (client_repl, port 7889)',
    onkeydown: e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); evalCode(); } e.stopPropagation(); } });
  el.out = h('pre', { class: 'cp-out' });
  const suggestions = ['Make the split button bigger', 'Why was my last run slow?', 'Add a compact mode for the Race page', 'What should I drill next?'];
  el.panes = {
    chat: h('div', { class: 'cp-pane' }, el.chat,
      h('div', { class: 'chips cp-sugg' }, suggestions.map(s => h('button', { class: 'chip', onclick: () => { el.input.value = s; send(); } }, s))),
      h('div', { class: 'cp-input' }, el.input, h('div', { class: 'row' }, el.send, el.stop, h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', title: 'Start a fresh conversation', onclick: newChat }, 'New chat')))),
    feed: h('div', { class: 'cp-pane' }, h('div', { class: 'note' }, 'Game client snapshot'), el.snap, h('div', { class: 'note', style: { marginTop: '8px' } }, 'Events, newest first'), el.feed),
    repl: h('div', { class: 'cp-pane' }, h('p', { class: 'note' }, 'Evaluate Clojure in the game client\'s REPL. Ctrl+Enter runs.'), el.code,
      h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: evalCode }, 'Run'), h('button', { class: 'btn sm ghost', onclick: () => { el.code.value = "(require '[osrs.client :as g])\n(g/on-client #(.getName (.getLocalPlayer @g/client)))"; } }, 'Example')), el.out),
  };
  panel = h('aside', { class: 'claude-panel', hidden: true, 'aria-label': 'Claude' },
    h('header', {}, h('b', {}, '✦ Claude'), el.status, h('span', { class: 'spacer' }), voice.toggleButton('claude', 'Speak', true, { className: 'btn sm ghost cp-say' }), h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: () => toggle(false) }, '×')),
    el.tabs, el.panes.chat, el.panes.feed, el.panes.repl);
  document.body.append(panel);
  paintTabs(); replay();
}
function paintTabs() {
  fill(el.tabs, [['chat', 'Chat'], ['feed', 'Live feed'], ['repl', 'REPL']].map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(S.tab === k), class: S.tab === k ? 'on' : '', onclick: () => { S.tab = k; keep(); paintTabs(); } }, l)));
  for (const [k, p] of Object.entries(el.panes)) p.hidden = k !== S.tab;
}
function setBusy(b) { busy = b; el.send.disabled = b; el.stop.hidden = !b; el.status.textContent = b ? 'working…' : 'ready'; }

// chat transcript: [{role:'user'|'claude'|'tool'|'info'|'error', text}]
function push(role, text) { S.log.push({ role, text }); keep(); return addMsg(role, text); }
function addMsg(role, text) {
  const m = h('div', { class: 'cp-msg ' + role }, text);
  el.chat.append(m); el.chat.scrollTop = el.chat.scrollHeight;
  return m;
}
function replay() { fill(el.chat); S.log.forEach(m => addMsg(m.role, m.text)); if (!S.log.length) addMsg('info', 'Ask about your runs, or tell me what to change. I can edit the app and you will see it reload.'); }
function newChat() { fetch('api/claude/new', { method: 'POST' }); S.log = []; keep(); replay(); }

async function send() {
  const prompt = el.input.value.trim();
  if (!prompt || busy) return;
  el.input.value = '';
  push('user', prompt);
  setBusy(true);
  const r = await fetch('api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, view: viewName() }) }).then(r => r.json()).catch(() => null);
  if (!r || !r.started) { setBusy(false); push('error', 'Claude is busy or the bridge is not running.'); }
}

async function evalCode() {
  const code = el.code.value.trim();
  if (!code) return;
  el.out.textContent = '…';
  const r = await fetch('api/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }).then(r => r.json()).catch(e => ({ error: String(e) }));
  el.out.textContent = r.error ? `Not connected: ${r.error}\nStart RuneLite with the client_repl plugin (port 7889).` : [r.out, r.err, r.value].filter(Boolean).join('\n');
}

// ------------------------------------------------------------------ stream
function onClaude(ev) {
  if (ev.type === 'start') { cur = null; return; }
  if (ev.type === 'done') { setBusy(false); cur = null; return; }
  if (ev.type === 'error') { push('error', ev.text); return; }
  // live text as it is typed
  if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
    if (!cur) { cur = push('claude', ''); }
    cur.textContent += ev.event.delta.text;
    S.log[S.log.length - 1].text = cur.textContent; keep();
    el.chat.scrollTop = el.chat.scrollHeight;
    return;
  }
  if (ev.type === 'stream_event' && ev.event?.type === 'message_start') { cur = null; return; }
  if (ev.type === 'assistant') {
    for (const c of ev.message?.content || []) if (c.type === 'tool_use') {
      const f = c.input?.file_path || c.input?.path || c.input?.pattern || '';
      push('tool', `${({ Edit: '✎ Editing', Write: '✎ Writing', Read: '👁 Reading', Grep: '🔍 Searching', Glob: '🔍 Finding' })[c.name] || c.name} ${String(f).replace(/^.*dragonwilds-speedrun[\\/]/, '')}`);
    }
    return;
  }
  if (ev.type === 'result') {
    if (!S.log.length || S.log[S.log.length - 1].role !== 'claude') push('claude', ev.result || '');
    // the finished reply, read aloud when the panel's 🔊 Speak toggle is on
    const reply = ev.result || [...S.log].reverse().find(m => m.role === 'claude')?.text || '';
    if (reply) voice.callout('claude', reply.replace(/```[\s\S]*?```/g, ' (code) ').replace(/[*_`#>]+/g, ''), { priority: 'normal' });
    const secs = ev.duration_ms ? (ev.duration_ms / 1000).toFixed(1) + ' s' : '';
    push('info', [secs, ev.total_cost_usd != null ? '$' + ev.total_cost_usd.toFixed(3) : ''].filter(Boolean).join(' · '));
  }
}
function onFeed(e) {
  el.feed.prepend(h('div', { class: 'cp-ev ' + (e.source || '') }, h('time', {}, new Date(e.at).toLocaleTimeString()), ' ', h('b', {}, `${e.source}/${e.type}`), ' ', e.text || ''));
  while (el.feed.children.length > 200) el.feed.lastChild.remove();
}
function onReload(files) {
  const cssOnly = files.every(f => f.endsWith('.css'));
  if (cssOnly) { document.querySelectorAll('link[rel=stylesheet][href*="css/"]').forEach(l => { l.href = l.href.split('?')[0] + '?v=' + Date.now(); }); toast('Style updated'); return; }
  toast('App updated — reloading');
  setTimeout(() => location.reload(), 300);
}
function connect() {
  es = new EventSource('api/events');
  es.onopen = () => { el.status.textContent = busy ? 'working…' : 'ready'; };
  es.onerror = () => { el.status.textContent = 'reconnecting…'; };
  es.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.type === 'hello') { fill(el.feed); (d.events || []).forEach(onFeed); el.snap.textContent = d.snapshot || 'No game client connected. Start RuneLite with the client_repl plugin.'; setBusy(!!d.busy); }
    else if (d.type === 'feed') onFeed(d.event);
    else if (d.type === 'game') el.snap.textContent = d.snapshot;
    else if (d.type === 'claude') onClaude(d.event);
    else if (d.type === 'reload') onReload(d.files || []);
  };
}
export const bridgeLive = () => live;
export { isTyping, $ };
