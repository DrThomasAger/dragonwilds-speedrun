// Installable app: service worker registration, install button, wake lock.
import { h, toast } from './util.js';

let deferred = null;
export function initPWA(slot) {
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const btn = h('button', { class: 'btn sm pri hidden', id: 'installBtn', title: 'Install as an app (works offline, opens in its own window)' }, '⤓ Install app');
  slot.append(btn);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.classList.remove('hidden'); });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const r = await deferred.userChoice; deferred = null; btn.classList.add('hidden');
    if (r.outcome === 'accepted') toast('Installed — find “DW Raid Lab” in your apps', 'good');
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
}

export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Keep the screen awake while a run, race or drill is active (phones, Fold).
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => (lock = null)); }
    else if (!on && lock) { await lock.release(); lock = null; }
  } catch { /* denied or unsupported */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lock === null && keepAwake.want) keepAwake(true); });
