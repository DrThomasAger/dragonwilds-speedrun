// Reel Studio — build, trim and play seamless multi-video clip reels.
import { h, fmtClock, fmtRun, clamp, isTyping, toast, download, pickFile, uid, enc, dec } from '../lib/util.js';
import { reelPlayer, timeline, nudgeRow, thumb } from '../lib/ui.js';
import { VIDEOS, BY_ID, chapterClips, KIND_LABEL } from '../data/videos.js';
import { SPLITS, RUNS, RUN, communityBest } from '../data/raid.js';
import { model } from '../lib/sync.js';
import * as store from '../lib/store.js';

export const title = 'Reel Studio';
export const keys = [['Space', 'Play / pause'], ['I / O', 'Set in / out to current frame'], [', .', 'Step 0.1 s (Shift 1 s)'], ['[ ]', 'Previous / next clip'], ['P', 'Preview the cut into this clip'], ['L', 'Loop current clip'], ['Z', 'Zoom timeline to clip'], ['Del', 'Remove clip'], ['Alt ↑↓', 'Move clip']];

const m = k => model(RUN[k], store.get().runs[k]);
const segClip = (run, k, extra = '') => { const r = m(run); return { vid: r.vid, in: +(r.offset + r.starts[k]).toFixed(2), out: +(r.offset + r.splits[k]).toFixed(2), label: `${r.runner} · ${SPLITS[k].short}${extra}` }; };

export function presets() {
  const cb = communityBest(RUNS.map(r => m(r.key)));
  const sob = cb.reduce((a, b) => a + b.seg, 0);
  const list = [
    { id: 'p-sob', name: `Community sum of best — ${fmtRun(sob, 1)} composite`, desc: 'The fastest segment from each record run, cut together seamlessly across videos. This is the time the current route can hit.', clips: cb.map((b, k) => segClip(b.run, k, ` (${fmtRun(b.seg, 1)})`)) },
    { id: 'p-tp650', name: 'TexasPete 6:50 (WR) — by split', desc: 'The record, one clip per split.', clips: SPLITS.map((_, k) => segClip('tp650', k)) },
    { id: 'p-nano', name: 'Nanobit 7:01 — by split', desc: 'Fastest 1.0.1-ruleset run, one clip per split.', clips: SPLITS.map((_, k) => segClip('nano701', k)) },
    ...SPLITS.map((s, k) => ({ id: 'p-seg' + k, name: `Split ${k + 1}: ${s.name} — every record`, desc: `${s.name} from each reference run, back to back.`, clips: RUNS.map(r => segClip(r.key, k)) })),
    { id: 'p-skips', name: 'Every 1.0.1 skip, explained (SamFPlays)', desc: 'The voice-guided skip guide, chapter by chapter.', clips: chapterClips(BY_ID.ESrrkdxD1fo) },
    { id: 'p-tech', name: 'Movement tech primer (Dotxy)', desc: 'Dive cancel → infinite double jump → flying through Kuldra\'s Sanctum on 1.0.1.2.', clips: [
      { vid: 'LGCddmk_TnM', in: 0, out: 51, label: 'Dive cancel' }, { vid: 'goKfbT19nkk', in: 0, out: 45, label: 'Infinite double jump' }, { vid: 'GeWbo4GpFEg', in: 0, out: 90.5, label: "Sanctum flight (1.0.1.2)" }] },
    { id: 'p-follow', name: '11-minute follow-along (SamFPlays, 1.0.1)', desc: 'A full post-patch run, chapter by chapter.', clips: chapterClips(BY_ID.WpvNjqVmpVM) },
  ];
  return list;
}

export function mount(root, { params }) {
  let reels = store.get().reels;
  let all = () => [...presets(), ...store.get().reels];
  let cur = null, sel = 0, tl = null, inRow, outRow, dirty = false;
  if (params.reel) { try { const r = dec(params.reel); cur = { id: 'shared', name: r.name || 'Shared reel', clips: r.clips, shared: true }; } catch { toast('That share link is damaged', 'bad'); } }
  if (!cur) cur = all().find(r => r.id === (params.id || store.get().prefs.reel)) || all()[0];

  root.append(h('div', { class: 'pagehead' },
    h('div', {}, h('h1', {}, 'Reel Studio'), h('p', {}, 'Clips from any videos play back to back with no gap: the next clip is buffered on a hidden second player and cut in on the exact frame. Drag a clip\'s handles and the video follows the handle so you see the frame you are cutting on.'))));
  const layout = h('div', { class: 'split-main' });
  const left = h('div'), right = h('div', { class: 'grid' });
  layout.append(left, right); root.append(layout);

  const P = reelPlayer(left, { sticky: false, onClip: i => { sel = i; paintList(); paintEditor(); }, onTime: (g, t) => { if (tl && P.reel.i === sel) tl.setPlayhead(t); inRow && inRow.refresh(); outRow && outRow.refresh(); } });
  const editor = h('div', { class: 'card', style: { marginTop: '14px' } });
  left.append(editor);

  // ---------------------------------------------------------------- right column
  const reelSel = h('select', { 'aria-label': 'Reel', style: { flex: 1, minWidth: 0 }, onchange: () => { const r = all().find(x => x.id === reelSel.value); if (r) open(r); } });
  const desc = h('p', { class: 'note' });
  const list = h('div', { class: 'cliplist', role: 'listbox', 'aria-label': 'Clips in this reel' });
  const total = h('span', { class: 'mono muted' });
  const reelCard = h('div', { class: 'card' },
    h('div', { class: 'row' }, reelSel),
    desc,
    h('div', { class: 'row', style: { margin: '8px 0' } },
      h('button', { class: 'btn pri', onclick: () => P.play(cur.clips, { name: cur.name }) }, '▶ Play reel'),
      h('button', { class: 'btn', onclick: newReel }, '+ New'),
      h('button', { class: 'btn', onclick: () => share() }, 'Share link'),
      h('button', { class: 'btn', onclick: () => download(`${slug(cur.name)}.reel.json`, JSON.stringify({ name: cur.name, clips: cur.clips }, null, 1)) }, 'Export'),
      h('button', { class: 'btn', onclick: importReel }, 'Import'),
      h('span', { class: 'spacer' }), total),
    list);
  right.append(reelCard, addCard());

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reel'; }
  function paintSelect() {
    const ps = presets(), mine = store.get().reels;
    reelSel.replaceChildren(
      cur.shared ? h('option', { value: 'shared', selected: true }, '🔗 ' + cur.name) : null,
      h('optgroup', { label: 'Presets' }, ps.map(r => h('option', { value: r.id, selected: r.id === cur.id }, r.name))),
      mine.length ? h('optgroup', { label: 'My reels' }, mine.map(r => h('option', { value: r.id, selected: r.id === cur.id }, r.name))) : null);
    desc.replaceChildren(cur.desc || (cur.id.startsWith('p-') ? '' : 'Your reel — every edit saves automatically.'),
      cur.shared ? h('button', { class: 'btn sm', style: { marginLeft: '8px' }, onclick: () => { const r = { ...cur, id: 'r-' + uid(), shared: false }; delete r.shared; store.update(s => s.reels.push(r)); open(r); toast('Saved to My reels', 'good'); } }, 'Save to my reels') : null,
      !cur.id.startsWith('p-') && !cur.shared ? h('span', {}, ' ', h('button', { class: 'btn xs', onclick: rename }, 'Rename'), ' ', h('button', { class: 'btn xs', onclick: delReel }, 'Delete reel')) : null);
  }
  function paintList() {
    const items = cur.clips.map((c, i) => {
      const v = BY_ID[c.vid] || {};
      const it = h('div', { class: 'clipitem' + (i === sel ? ' sel' : '') + (i === P.reel.i && P.clips.length ? ' cur' : ''), draggable: true, role: 'option', 'aria-selected': String(i === sel), dataset: { i },
        onclick: () => { sel = i; paintList(); paintEditor(); } },
        h('span', { class: 'grip', title: 'Drag to reorder' }, '⋮⋮'),
        h('img', { src: thumb(c.vid), alt: '', loading: 'lazy' }),
        h('div', { class: 't' }, c.label || v.title, h('small', {}, `${v.author || ''} · ${fmtClock(c.in, true)}→${fmtClock(c.out, true)} · ${fmtRun(c.out - c.in, 1)}`)),
        h('div', { class: 'row tight' },
          h('button', { class: 'btn xs', title: 'Play from this clip', onclick: e => { e.stopPropagation(); P.play(cur.clips, { start: i, name: cur.name }); } }, '▶'),
          h('button', { class: 'btn xs', title: 'Play only this clip, looped', onclick: e => { e.stopPropagation(); solo(i); } }, '⟲'),
          h('button', { class: 'btn xs', title: 'Remove', onclick: e => { e.stopPropagation(); remove(i); } }, '✕')));
      it.addEventListener('dragstart', e => { it.classList.add('dragging'); e.dataTransfer.setData('text/plain', String(i)); });
      it.addEventListener('dragend', () => it.classList.remove('dragging'));
      it.addEventListener('dragover', e => { e.preventDefault(); it.classList.add('dropbefore'); });
      it.addEventListener('dragleave', () => it.classList.remove('dropbefore'));
      it.addEventListener('drop', e => { e.preventDefault(); it.classList.remove('dropbefore'); move(+e.dataTransfer.getData('text/plain'), i); });
      return it;
    });
    list.replaceChildren(...(items.length ? items : [h('div', { class: 'empty' }, 'No clips yet — add one below.')]));
    total.textContent = `${cur.clips.length} clips · ${fmtRun(cur.clips.reduce((a, c) => a + c.out - c.in, 0), 1)}`;
  }

  // ---------------------------------------------------------------- editor
  function paintEditor() {
    const c = cur.clips[sel];
    if (!c) { editor.replaceChildren(h('div', { class: 'empty' }, 'Select a clip to trim it.')); tl = null; inRow = outRow = null; return; }
    const v = BY_ID[c.vid] || { dur: Math.max(c.out + 30, 600), title: c.vid };
    const ensureLoaded = () => { if (P.clips !== cur.clips || P.reel.i !== sel) P.play(cur.clips, { start: sel, name: cur.name, autoplay: false }); };
    tl = timeline({
      duration: v.dur, clip: c, chapters: v.chapters || [],
      onScrub: (t, final) => { ensureLoaded(); P.reel.active.pause(); P.reel.scrub(t, final); },
      onChange: () => { edited(); inRow.refresh(); outRow.refresh(); },
      onCommit: () => { P.reel.refresh(); paintList(); },
      onSeek: t => { ensureLoaded(); P.reel.scrub(t, true); },
    });
    const setIn = t => { c.in = clamp(t, 0, c.out - 0.2); after(); }, setOut = t => { c.out = clamp(t, c.in + 0.2, v.dur); after(); };
    const now = () => (P.reel.clip === c || P.reel.i === sel ? P.reel.active.time() : c.in);
    function after() { edited(); tl.paint(); inRow.refresh(); outRow.refresh(); P.reel.refresh(); paintList(); ensureLoaded(); }
    inRow = nudgeRow('In', () => c.in, t => { setIn(t); P.reel.scrub(c.in, true); }, now);
    outRow = nudgeRow('Out', () => c.out, t => { setOut(t); P.reel.scrub(c.out, true); }, now);
    const label = h('input', { type: 'text', value: c.label || '', 'aria-label': 'Clip label', style: { flex: 1 }, oninput: () => { c.label = label.value; edited(); }, onchange: () => paintList() });
    const zoomBtn = h('button', { class: 'btn sm', onclick: () => { tl.setZoom(!tl.zoom); zoomBtn.classList.toggle('on', tl.zoom); } }, '🔍 Zoom to clip');
    editor.replaceChildren(
      h('div', { class: 'row' }, h('h2', { style: { margin: 0 } }, `Clip ${sel + 1}`), h('span', { class: 'note' }, `${v.author || ''} — ${v.title}`), h('span', { class: 'spacer' }),
        h('span', { class: 'mono' }, 'length ', h('b', { class: 'mono' }, fmtRun(c.out - c.in, 1)))),
      h('div', { class: 'row', style: { marginTop: '8px' } }, label, zoomBtn),
      tl.el,
      h('div', { class: 'grid g2' }, inRow.el, outRow.el),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn', title: 'Play 3 s before the cut into this clip (P)', disabled: sel === 0, onclick: previewCut }, '⇥ Preview cut in'),
        h('button', { class: 'btn', title: 'Play the last 3 s of this clip into the next', disabled: sel >= cur.clips.length - 1, onclick: previewCutOut }, 'Preview cut out ⇥'),
        h('button', { class: 'btn', onclick: () => solo(sel) }, '⟲ Play solo (loop)'),
        h('button', { class: 'btn', onclick: () => duplicate(sel) }, 'Duplicate'),
        h('span', { class: 'spacer' }),
        h('span', { class: 'note' }, 'Drag handles · ←/→ on a focused handle = 0.1 s (Shift 1 s)')));
    tl.setZoom(true); zoomBtn.classList.add('on');
  }
  function previewCut() { const p = cur.clips[sel - 1]; const pre = Math.max(p.in, p.out - 3); P.play(cur.clips, { start: sel - 1, name: cur.name }); setTimeout(() => P.reel.active.seek(pre), 150); }
  function previewCutOut() { const c = cur.clips[sel]; const pre = Math.max(c.in, c.out - 3); P.play(cur.clips, { start: sel, name: cur.name }); setTimeout(() => P.reel.active.seek(pre), 150); }
  function solo(i) { P.play([cur.clips[i]], { name: 'Solo: ' + (cur.clips[i].label || '') }); if (!P.reel.loopClip) P.card.querySelector('.transport button[title^="Loop the current"]').click(); }

  // ---------------------------------------------------------------- mutations
  function editable() {
    if (!cur.id.startsWith('p-') && !cur.shared) return;
    const copy = { id: 'r-' + uid(), name: cur.name.replace(/ — .*$/, '') + ' (edit)', clips: cur.clips };
    store.update(s => s.reels.push(copy));
    cur = copy; store.update(s => (s.prefs.reel = cur.id));
    paintSelect();
    toast('Preset copied to My reels — edits save there', 'good');
  }
  const persist = () => store.update(s => { const r = s.reels.find(x => x.id === cur.id); if (r) r.clips = cur.clips; });
  function edited() { if (cur.id.startsWith('p-') || cur.shared) editable(); persist(); }
  function remove(i) { edited(); cur.clips.splice(i, 1); persist(); sel = clamp(sel, 0, cur.clips.length - 1); P.setClips(P.clips === cur.clips ? cur.clips : P.clips); paintList(); paintEditor(); }
  function duplicate(i) { edited(); cur.clips.splice(i + 1, 0, { ...cur.clips[i] }); persist(); sel = i + 1; paintList(); paintEditor(); }
  function move(from, to) { if (from === to) return; edited(); const [c] = cur.clips.splice(from, 1); cur.clips.splice(to, 0, c); persist(); sel = to; paintList(); paintEditor(); P.reel.refresh(); }
  function newReel() { const r = { id: 'r-' + uid(), name: 'New reel', clips: [] }; store.update(s => s.reels.push(r)); open(r); }
  function rename() { const n = prompt('Reel name', cur.name); if (n) { cur.name = n; store.update(s => { const r = s.reels.find(x => x.id === cur.id); if (r) r.name = n; }); paintSelect(); } }
  function delReel() { if (!confirm(`Delete “${cur.name}”?`)) return; store.update(s => (s.reels = s.reels.filter(r => r.id !== cur.id))); open(presets()[0]); }
  function share() {
    const url = `${location.origin}${location.pathname}#/studio?reel=${enc({ name: cur.name, clips: cur.clips.map(({ vid, in: a, out, label }) => ({ vid, in: a, out, label })) })}`;
    navigator.clipboard && navigator.clipboard.writeText(url).then(() => toast('Share link copied', 'good'), () => prompt('Copy this link', url));
    if (!navigator.clipboard) prompt('Copy this link', url);
  }
  async function importReel() {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try { const r = JSON.parse(f.text); if (!Array.isArray(r.clips)) throw 0; const reel = { id: 'r-' + uid(), name: r.name || f.name, clips: r.clips }; store.update(s => s.reels.push(reel)); open(reel); toast('Reel imported', 'good'); }
    catch { toast('Not a reel file', 'bad'); }
  }
  function open(r) {
    cur = r; sel = 0; store.update(s => (s.prefs.reel = r.id));
    paintSelect(); paintList(); paintEditor();
    if (cur.clips.length) P.play(cur.clips, { name: cur.name, autoplay: false });
  }

  // ---------------------------------------------------------------- add clip
  function addCard() {
    const vsel = h('select', { 'aria-label': 'Video', style: { width: '100%' } },
      Object.entries(KIND_LABEL).map(([k, l]) => h('optgroup', { label: l }, VIDEOS.filter(v => v.kind === k).map(v => h('option', { value: v.id }, `${v.author} — ${v.title}`)))));
    const csel = h('select', { 'aria-label': 'Chapter', style: { width: '100%' } });
    const fill = () => {
      const v = BY_ID[vsel.value];
      const opts = [['whole', `Whole video (${fmtClock(v.dur)})`]];
      chapterClips(v).forEach((c, i) => opts.push(['c' + i, `${fmtClock(c.in)} ${c.label}`]));
      const run = RUNS.find(r => r.vid === v.id);
      if (run) SPLITS.forEach((s, k) => opts.push(['s' + k, `Split ${k + 1}: ${s.name}`]));
      opts.push(['here', 'From the current frame (+10 s)']);
      csel.replaceChildren(...opts.map(([v2, l]) => h('option', { value: v2 }, l)));
    };
    vsel.addEventListener('change', fill); fill();
    const add = () => {
      const v = BY_ID[vsel.value], k = csel.value;
      let c;
      if (k === 'whole') c = { vid: v.id, in: 0, out: v.dur, label: v.title };
      else if (k[0] === 'c') c = chapterClips(v)[+k.slice(1)];
      else if (k[0] === 's') { const run = RUNS.find(r => r.vid === v.id); c = segClip(run.key, +k.slice(1)); }
      else { const t = P.reel.clip && P.reel.clip.vid === v.id ? P.reel.active.time() : 0; c = { vid: v.id, in: +t.toFixed(1), out: +Math.min(v.dur, t + 10).toFixed(1), label: v.title }; }
      edited(); cur.clips.splice(sel + 1, 0, { ...c }); persist(); sel = Math.min(sel + 1, cur.clips.length - 1); paintList(); paintEditor(); P.reel.refresh();
      toast('Clip added', 'good');
    };
    return h('div', { class: 'card' }, h('h2', {}, 'Add a clip'), h('div', { class: 'grid' }, vsel, csel, h('button', { class: 'btn pri', onclick: add }, '+ Insert after selected')),
      h('p', { class: 'note' }, 'Chapters are the creators\' own. Split clips use the measured split marks, including any corrections you made in Race the WR.'));
  }

  // ---------------------------------------------------------------- keys
  const onKey = e => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || document.querySelector('dialog[open]')) return;
    const c = cur.clips[sel];
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(sel, clamp(sel + (e.key === 'ArrowUp' ? -1 : 1), 0, cur.clips.length - 1)); return; }
    if (e.altKey) return;
    if ((e.key === 'i' || e.key === 'I') && c) { inRow && (edited(), c.in = clamp(+P.reel.active.time().toFixed(1), 0, c.out - 0.2), paintEditor(), P.reel.refresh(), paintList()); return; }
    if ((e.key === 'o' || e.key === 'O') && c) { outRow && (edited(), c.out = clamp(+P.reel.active.time().toFixed(1), c.in + 0.2, 1e6), paintEditor(), P.reel.refresh(), paintList()); return; }
    if (e.key === ',' || e.key === '.') { e.preventDefault(); P.reel.pause(); const d = (e.key === ',' ? -1 : 1) * (e.shiftKey ? 1 : 0.1); P.reel.scrub(P.reel.active.time() + d, true); return; }
    if (e.key === 'p' || e.key === 'P') { if (sel > 0) previewCut(); return; }
    if (e.key === 'z' || e.key === 'Z') { tl && editor.querySelector('.btn.sm').click(); return; }
    if (e.key === 'Delete' && c) { remove(sel); return; }
    if (e.key === '[' || e.key === ']') { if (!P.clips.length) return; P.key(e); return; }
    if (P.clips.length) P.key(e);
    else if (e.code === 'Space') { e.preventDefault(); P.play(cur.clips, { start: sel, name: cur.name }); }
  };
  document.addEventListener('keydown', onKey);

  paintSelect(); paintList(); paintEditor();
  if (cur.clips.length) P.play(cur.clips, { name: cur.name, autoplay: false });
  return () => { document.removeEventListener('keydown', onKey); P.destroy(); };
}
