// Force-directed graph of the knowledge base on a canvas: nodes coloured by type,
// drag to pan, wheel / pinch to zoom, drag a node to move it, click a node to open it.
// createGraph(canvas, { nodes, edges, focus, onOpen }) -> { setTypes, setFocus, fit, destroy, stats }

export const TYPE_COLOR = {
  index: '#eee7d8', split: '#e2bb4f', run: '#e8813a', runner: '#f2a65a', skip: '#4fc28a', technique: '#8fe3b8',
  requirement: '#a98ce8', phase: '#8170c0', wiki: '#63a8e8', video: '#c77be0', stream: '#9b6ee8', thread: '#d48fb8',
  channel: '#b5a78c', source: '#8a8170', patch: '#e0584f', news: '#a0605a', day: '#5d8aa8', math: '#5fd0d0', analysis: '#38b6c6', post: '#e8c98f', build: '#ef9a7a',
};
export const TYPE_LABEL = {
  index: 'Hubs', split: 'Splits', run: 'Runs', runner: 'Runners', skip: 'Skips', technique: 'Techniques', requirement: 'Requirements',
  phase: 'Hardcore phases', wiki: 'Wiki', video: 'Videos', stream: 'Streams', thread: 'Threads', channel: 'Creators', source: 'Sources',
  patch: 'Patches', news: 'News', day: 'Daily notes', math: 'Maths', analysis: 'Analysis', post: 'Blog posts', build: 'Builds',
};
export const colorOf = t => TYPE_COLOR[t] || '#a39a87';

// Deterministic start positions so the layout looks the same on every open.
const hash = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };

export function createGraph(canvas, { nodes, edges, focus = null, onOpen = () => {} }) {
  const ctx = canvas.getContext('2d');
  const N = nodes.map(n => {
    const a = hash(n.id) * Math.PI * 2, r = 60 + hash(n.id + '#') * 340;
    return { ...n, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, r: 3.5 + Math.sqrt(n.n || 0) * 1.4, on: true, nb: new Set() };
  });
  const byId = new Map(N.map(n => [n.id, n]));
  const E = edges.map(([a, b]) => [byId.get(a), byId.get(b)]).filter(([a, b]) => a && b && a !== b);
  for (const [a, b] of E) { a.nb.add(b); b.nb.add(a); }
  let view = { k: 1, x: 0, y: 0 }, W = 0, H = 0, dpr = 1;
  let alpha = 1, raf = 0, hover = null, cur = focus ? byId.get(focus) : null, fitted = false, dead = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (!fitted) fit(); else draw();
  }
  const visible = () => N.filter(n => n.on);

  function tick() {
    const vs = visible(), n = vs.length;
    const rep = 900 * alpha;
    for (let i = 0; i < n; i++) {
      const a = vs[i];
      for (let j = i + 1; j < n; j++) {
        const b = vs[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 160000) continue;                  // ignore pairs more than 400 apart
        if (d2 < 0.01) { dx = hash(a.id + b.id) - 0.5; dy = 0.5 - hash(b.id + a.id); d2 = 0.5; }
        const f = rep / d2;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    for (const [a, b] of E) {
      if (!a.on || !b.on) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 46) / d * 0.04 * alpha;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const v of vs) {
      v.vx -= v.x * 0.006 * alpha; v.vy -= v.y * 0.006 * alpha;
      if (v.fixed) { v.vx = v.vy = 0; continue; }
      v.vx *= 0.6; v.vy *= 0.6;
      const sp = Math.hypot(v.vx, v.vy); if (sp > 30) { v.vx *= 30 / sp; v.vy *= 30 / sp; }
      v.x += v.vx; v.y += v.vy;
    }
    alpha *= 0.985;
  }

  function loop() {
    raf = 0;
    if (dead) return;
    const steps = alpha > 0.5 ? 3 : 1;
    for (let i = 0; i < steps && alpha > 0.02; i++) tick();
    if (!fitted) {
      fit();
      // opened from a page: zoom in on that page's neighbourhood once the layout settles
      if (fitted && cur) { const k = Math.min(4, view.k * 2.4); view = { k, x: W / 2 - cur.x * k, y: H / 2 - cur.y * k }; }
    }
    draw();
    if (alpha > 0.02) raf = requestAnimationFrame(loop);
  }
  const kick = (a = 0.4) => { alpha = Math.max(alpha, a); if (!raf) raf = requestAnimationFrame(loop); };

  function fit() {
    const vs = visible();
    if (!vs.length || !W) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of vs) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
    const k = Math.min(W / (x1 - x0 + 60), H / (y1 - y0 + 60), 3);
    view = { k, x: W / 2 - (x0 + x1) / 2 * k, y: H / 2 - (y0 + y1) / 2 * k };
    fitted = alpha < 0.35;
    draw();
  }
  const toScreen = v => [v.x * view.k + view.x, v.y * view.k + view.y];
  const toWorld = (sx, sy) => [(sx - view.x) / view.k, (sy - view.y) / view.k];

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const hi = hover || cur;
    ctx.lineWidth = 1;
    for (const [a, b] of E) {
      if (!a.on || !b.on) continue;
      const lit = hi && (a === hi || b === hi);
      ctx.strokeStyle = lit ? 'rgba(232,129,58,.85)' : hi ? 'rgba(160,150,130,.08)' : 'rgba(160,150,130,.18)';
      const [ax, ay] = toScreen(a), [bx, by] = toScreen(b);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    const vs = visible();
    for (const v of vs) {
      const [x, y] = toScreen(v);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const r = Math.max(2, v.r * Math.sqrt(view.k));
      const dim = hi && v !== hi && !hi.nb.has(v);
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.fillStyle = colorOf(v.type);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (v === cur || v === hover) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.font = '12px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    for (const v of vs) {
      const near = hi && (v === hi || hi.nb.has(v));
      const big = v.n >= 14 / Math.max(0.35, view.k);
      if (!(near || big || v === cur)) continue;
      if (hi && !near && v !== cur) continue;
      const [x, y] = toScreen(v);
      if (x < -50 || y < -20 || x > W + 50 || y > H + 20) continue;
      const label = v.title.length > 34 ? v.title.slice(0, 33) + '…' : v.title;
      const r = Math.max(2, v.r * Math.sqrt(view.k));
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(13,12,11,.9)'; ctx.strokeText(label, x + r + 4, y);
      ctx.fillStyle = v === hi ? '#fff' : '#d8d0c0'; ctx.fillText(label, x + r + 4, y);
    }
    canvas.dataset.drawn = String((+canvas.dataset.drawn || 0) + 1);
  }

  function pick(sx, sy) {
    let best = null, bd = Infinity;
    for (const v of visible()) {
      const [x, y] = toScreen(v), r = Math.max(6, v.r * Math.sqrt(view.k) + 3);
      const d = Math.hypot(x - sx, y - sy);
      if (d < r && d < bd) { best = v; bd = d; }
    }
    return best;
  }

  // ---------------------------------------------------------------- input
  const ptrs = new Map();
  let drag = null, moved = 0, pinch = null;
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onDown(e) {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    ptrs.set(e.pointerId, [x, y]);
    moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; return; }
    const v = pick(x, y);
    drag = v ? { node: v, x, y } : { pan: true, x, y, vx: view.x, vy: view.y };
    if (v) v.fixed = true;
  }
  function onMove(e) {
    const [x, y] = pos(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [x, y]);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      zoomAt(pinch.mid[0], pinch.mid[1], pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d);
      moved += 10; return;
    }
    if (drag) {
      moved += Math.abs(x - drag.x) + Math.abs(y - drag.y);
      if (drag.node) { const [wx, wy] = toWorld(x, y); drag.node.x = wx; drag.node.y = wy; kick(0.15); }
      else { view.x = drag.vx + (x - drag.x); view.y = drag.vy + (y - drag.y); fitted = true; draw(); }
      if (!drag.node) return;
      drag.x = x; drag.y = y;
      return;
    }
    const v = pick(x, y);
    if (v !== hover) { hover = v; canvas.style.cursor = v ? 'pointer' : 'grab'; canvas.title = v ? v.title : ''; draw(); }
  }
  function onUp(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag?.node) { drag.node.fixed = false; if (moved < 6) onOpen(drag.node.id); }
    drag = null;
  }
  function zoomAt(sx, sy, k) {
    k = Math.min(8, Math.max(0.08, k));
    const [wx, wy] = toWorld(sx, sy);
    view = { k, x: sx - wx * k, y: sy - wy * k };
    fitted = true; draw();
  }
  const onWheel = e => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, view.k * Math.exp(-e.deltaY * 0.0015)); };
  const onLeave = () => { if (hover) { hover = null; draw(); } };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  kick(1);

  return {
    setTypes(types) { for (const v of N) v.on = types.has(v.type); fitted = false; kick(0.5); },
    setFocus(id) { cur = byId.get(id) || null; draw(); },
    zoom(f) { zoomAt(W / 2, H / 2, view.k * f); },
    fit() { fitted = false; fit(); fitted = true; },
    screenOf(id) { const v = byId.get(id); return v && v.on ? toScreen(v) : null; },
    stats: () => ({ nodes: visible().length, edges: E.filter(([a, b]) => a.on && b.on).length, alpha, k: view.k }),
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
