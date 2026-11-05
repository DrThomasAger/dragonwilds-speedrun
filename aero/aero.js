// Aero, the moving parts: the sea with dolphins, tilt toward the pointer, and wallpaper
// parallax. DrThomasAger/dragonwilds-speedrun, folder aero/ (README.md beside it).
// No knowledge of any one site. Pair with aero.css beside it.
//
//   import { initAero3D } from './aero/aero.js';
//   initAero3D({ tilt: '.card', max: 5, dolphins: 4 });
//
// Sets on <html>: --aero-gx / --aero-gy (-1..1, from device tilt or the pointer) and
// --aero-sy (scroll in px). Each tilt element gets class aero-tilt and its own
// --aero-rx / --aero-ry while a pointer or finger is on it. Under reduced motion
// only the still scene is built.
export function initAero3D({ tilt = '.aero-window', max = 5, dolphins = 4, scene = true } = {}) {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (scene && !document.querySelector('.aero-scene')) document.body.prepend(buildScene(dolphins));
  if (still) return;

  let raf = 0, gx = 0, gy = 0;
  const paint = () => { raf = 0; root.style.setProperty('--aero-gx', gx.toFixed(3)); root.style.setProperty('--aero-gy', gy.toFixed(3)); root.style.setProperty('--aero-sy', String(Math.round(scrollY))); };
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { gx = e.clientX / innerWidth * 2 - 1; gy = e.clientY / innerHeight * 2 - 1; ask(); } }, { passive: true });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    gx = Math.max(-1, Math.min(1, e.gamma / 30)); gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); ask();
  }, { passive: true });

  // tilt: whichever tilt element the pointer is over leans toward it
  let cur = null;
  const lean = (el, x, y) => {
    const r = el.getBoundingClientRect();
    const px = (x - r.left) / r.width - .5, py = (y - r.top) / r.height - .5;
    const k = Math.min(1, 600 / Math.max(r.height, 1));   // tall cards lean less
    el.style.setProperty('--aero-ry', (px * 2 * max * k).toFixed(2) + 'deg');
    el.style.setProperty('--aero-rx', (-py * 2 * max * k).toFixed(2) + 'deg');
  };
  const rest = el => { if (!el) return; el.classList.remove('aero-tilting'); el.style.removeProperty('--aero-rx'); el.style.removeProperty('--aero-ry'); };
  const mark = () => document.querySelectorAll(tilt).forEach(el => el.classList.add('aero-tilt'));
  mark(); new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
  addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('.aero-tilt');
    if (el !== cur) { rest(cur); cur = el; }
    if (el) { el.classList.add('aero-tilting'); lean(el, e.clientX, e.clientY); }
  }, { passive: true });
  addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('.aero-tilt'); if (el) { cur = el; el.classList.add('aero-tilting'); lean(el, e.clientX, e.clientY); } }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave', 'scroll'].forEach(t => addEventListener(t, () => { rest(cur); cur = null; }, { passive: true }));
}

function buildScene(n) {
  const s = document.createElement('div');
  s.className = 'aero-scene'; s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<div class="sea"><div class="caustics"></div></div>';
  // each dolphin: where it leaps from, how long one cycle is, its delay, and direction
  const pods = [[8, 13, 0, 0], [46, 11, 3.2, 1], [70, 15, 6.5, 0], [24, 12, 8.8, 1], [58, 14, 10.5, 0], [84, 16, 2, 1]].slice(0, n);
  for (const [x, t, d, flip] of pods) {
    s.insertAdjacentHTML('beforeend',
      `<span class="aero-pod${flip ? ' flip' : ''}" style="--x:${x}%;--t:${t}s;--d:${d}s">` +
      `<i class="aero-splash" style="--sx:0px;--sd:0s"></i><i class="aero-dolphin"></i>` +
      `<i class="aero-splash" style="--sx:200px;--sd:${(t * .3).toFixed(2)}s"></i></span>`);
  }
  return s;
}
