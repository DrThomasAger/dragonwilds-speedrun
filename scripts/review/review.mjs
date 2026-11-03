// Review one source end to end:
//   metadata + captions → transcript (captions | kb cache | faster-whisper | none)
//   → [full level] 360p download → scan.py features → banner/end events → splits,
//     segment times vs reference, anomalies, blackouts → contact sheets
//   → keyword mining (transcript, description, comments, speedrun.com notes)
//   → candidate NEW mechanics → data/kb/reviews/<id>.json + docs/review/<id>.md
import path from 'node:path';
import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { ROOT, OUT, DOCS, DIRS, TEMPLATES, YTDLP, FFMPEG, FFPROBE, PYTHON, EXTRA_VIDEO_DIRS, run, readJson, writeJson, writeText, exists, now, link, fmt, clip, tools, VALID_ID, scanVersion, isBotBlock } from './lib.mjs';
import { fetchMeta, captionLines, rawLines, whisperLines } from './transcript.mjs';
import { detectEvents } from './detect.mjs';
import { reference, analyzeRun, statedTime, patchAt } from './analyze.mjs';
import { mineLines, knownMechanics, candidateFromLine, matchKnown, topicsOf } from './mine.mjs';

export const PIPELINE_VERSION = 1;
const MAX_VIDEO_S = 45 * 60;

export async function download(id) {
  const file = path.join(DIRS.vid, `${id}.mp4`);
  if (await exists(file)) return { file, cached: true };
  for (const d of EXTRA_VIDEO_DIRS) {
    const f = path.join(d, `${id}.mp4`);
    if (await exists(f)) { await copyFile(f, file); return { file, cached: true, from: d }; }
  }
  const r = await run(YTDLP, ['-f', '18/bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[height<=360]/worst', '--merge-output-format', 'mp4',
    '--ffmpeg-location', path.dirname(FFMPEG), '--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--no-part',
    '-o', path.join(DIRS.vid, '%(id)s.%(ext)s'), `https://www.youtube.com/watch?v=${id}`], { timeout: 40 * 60 * 1000 });
  if (await exists(file)) return { file, cached: false };
  return { file: null, error: (r.stderr.split('\n').filter(l => /ERROR/.test(l)).join(' ') || r.stderr).slice(0, 300), botBlock: isBotBlock(r.stderr) };
}

// A file with an audio stream for whisper: the 360p download normally has one; cached
// video-only files get the audio track fetched separately.
export async function audioSource(id, video, info = {}) {
  if (video) {
    const p = await run(FFPROBE, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', video], { timeout: 60000 });
    if (p.code === 0 && p.stdout.trim()) return video;
  }
  let files = [];
  try { files = (await readdir(DIRS.vid)).filter(f => f.startsWith(`${id}.audio.`)); } catch {}
  if (files.length) return path.join(DIRS.vid, files[0]);
  const r = await run(YTDLP, ['-f', 'ba[ext=m4a]/ba', '--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--no-part',
    '-o', path.join(DIRS.vid, '%(id)s.audio.%(ext)s'), `https://www.youtube.com/watch?v=${id}`], { timeout: 20 * 60 * 1000 });
  files = (await readdir(DIRS.vid)).filter(f => f.startsWith(`${id}.audio.`));
  if (!files.length && isBotBlock(r.stderr)) info.botBlock = r.stderr.split('\n').find(l => /ERROR/.test(l)) || 'bot check';
  return files.length ? path.join(DIRS.vid, files[0]) : null;
}

export async function features(id, video) {
  const cache = path.join(DIRS.work, `${id}.${await scanVersion()}.f.json`);
  const c = await readJson(cache, null);
  if (c?.n) return c;
  const r = await run(PYTHON, ['-I', path.join(ROOT, 'scripts', 'review', 'scan.py'), video, TEMPLATES, '--ffmpeg', FFMPEG], { timeout: 90 * 60 * 1000 });
  if (r.code !== 0 || !r.stdout.startsWith('{')) throw new Error('scan failed: ' + r.stderr.slice(-300));
  const f = JSON.parse(r.stdout);
  await writeJson(cache, f, false);
  return f;
}

// Contact sheet: `n` frames evenly over [a, b] (video s), 4 per row, 320x180 each.
export async function contactSheet(video, a, b, out, n = 12) {
  if (await exists(out)) return out;
  await mkdir(path.dirname(out), { recursive: true });
  const dur = Math.max(1, b - a), cols = 4, rows = Math.ceil(n / cols);
  const r = await run(FFMPEG, ['-v', 'error', '-y', '-ss', a.toFixed(2), '-t', dur.toFixed(2), '-i', video,
    '-vf', `fps=${(n / dur).toFixed(4)},scale=320:180,drawtext=text='%{pts\\:hms\\:${a.toFixed(2)}}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}`,
    '-frames:v', '1', out], { timeout: 5 * 60 * 1000 });
  if (r.code !== 0) {
    // drawtext needs a font; retry without the timestamp label
    const r2 = await run(FFMPEG, ['-v', 'error', '-y', '-ss', a.toFixed(2), '-t', dur.toFixed(2), '-i', video, '-vf', `fps=${(n / dur).toFixed(4)},scale=320:180,tile=${cols}x${rows}`, '-frames:v', '1', out], { timeout: 5 * 60 * 1000 });
    if (r2.code !== 0) return null;
  }
  return out;
}

const relFrames = p => (p ? path.relative(DIRS.frames, p).split(path.sep).join('/') : null);

export async function reviewSource(item, { level = 'full', known = null, ref = null, log = () => {} } = {}) {
  const id = item.id;
  const base = { id, url: `https://www.youtube.com/watch?v=${id}`, reviewedAt: now(), pipelineVersion: PIPELINE_VERSION, level };
  if (!VALID_ID.test(String(id || ''))) return { ...base, status: 'invalid', error: `invalid YouTube id "${id}"` };
  const t = await tools();
  if (!t.ytdlp) return { ...base, status: 'error', error: 'yt-dlp not available' };

  const m = await fetchMeta(id, { retrySubs: !!item.transcriptRetry });
  // bot check: not a failure of this video; run.mjs backs it off and retries later
  const deferred = error => ({ ...base, status: 'deferred', error, rateLimited: true, botBlock: true, title: item.title || null });
  if (!m.ok && m.botBlock) return deferred(m.error);
  if (!m.ok) return { ...base, status: m.unavailable ? 'unavailable' : 'error', error: m.error, rateLimited: !!m.rateLimited, title: item.title || null };
  const meta = m.meta;
  known ||= await knownMechanics();
  ref ||= await reference();

  // ---- transcript
  let tr = await captionLines(id);
  const raw = await rawLines(id);
  // light level: the ingest cache's merged caption lines are good enough; full level
  // prefers word-timed whisper over them and falls back to them below
  if (!tr && raw?.lines && level !== 'full') tr = { lines: raw.lines, source: raw.source };

  // ---- video analysis
  let analysis = null, videoFile = null, visual = { status: 'skipped' };
  const canVideo = level === 'full' && t.ffmpeg && t.cv && meta.duration && meta.duration <= MAX_VIDEO_S;
  if (level === 'full' && !canVideo) visual = { status: 'skipped', reason: !t.ffmpeg ? 'ffmpeg missing' : !t.cv ? 'python cv2 missing' : `video longer than ${MAX_VIDEO_S / 60} min` };
  // a full review without the video tools is only a light review
  if (level === 'full' && (!t.ffmpeg || !t.cv)) { level = 'light'; base.level = level; }
  if (canVideo) {
    const d = await download(id);
    if (!d.file && d.botBlock) return deferred(d.error);
    if (!d.file) visual = { status: 'error', reason: 'download failed: ' + d.error };
    else {
      videoFile = d.file;
      log(`  scan ${id}`);
      try {
        const f = await features(id, videoFile);
        const events = detectEvents(f);
        const stated = item.run?.time ?? statedTime(meta.title);
        analysis = analyzeRun({ id, events, f, ref, statedRunTime: stated, date: item.run?.date || meta.date });
        analysis.events = { banners: events.banners, end: events.end, loadEnd: events.loadEnd };
        visual = { status: 'ok' };
      } catch (e) { visual = { status: 'error', reason: e.message.slice(0, 300) }; }
    }
  }
  const noTalk = /no commentary|no mic|\bost\b|soundtrack/i.test(meta.title || '');
  if (noTalk && !tr) visual.whisperSkipped = 'title says no commentary';
  if (!tr && !noTalk && level === 'full' && t.whisper && meta.duration && meta.duration <= MAX_VIDEO_S) {
    log(`  whisper ${id}`);
    const ai = {};
    const audio = await audioSource(id, videoFile, ai);
    if (!audio && ai.botBlock) return deferred(ai.botBlock);
    const w = audio ? await whisperLines(id, audio) : { error: 'no audio track could be fetched' };
    if (w.lines?.length) tr = { lines: w.lines, source: w.source };
    else if (w.error) visual.whisperError = w.error.slice(0, 200);
  }
  if (!tr && raw?.lines) tr = { lines: raw.lines, source: raw.source };
  const transcriptSource = tr?.source || (level === 'full' && !t.whisper ? 'none (no captions; whisper not installed)' : 'none');

  // ---- commentary
  const commentary = mineLines(tr?.lines || []).map(l => ({ ...l, link: link(id, l.t), known: matchKnown(l.text, known)?.id || null }));
  const textNotes = [];
  for (const line of (meta.description || '').split(/\n+/)) if (line.trim() && topicsOf(line).length) textNotes.push({ where: 'description', text: clip(line.trim(), 400), topics: topicsOf(line) });
  for (const c of raw?.raw?.comments || []) if (topicsOf(c.text).some(x => ['skip', 'glitch', 'trick', 'cancel', 'movement'].includes(x))) textNotes.push({ where: 'comment', author: c.author, likes: c.likes, text: clip(c.text, 400), topics: topicsOf(c.text) });
  if (item.run?.comment) textNotes.push({ where: 'speedrun.com comment', text: item.run.comment, topics: topicsOf(item.run.comment) });
  if (item.run?.examinerNote) textNotes.push({ where: 'speedrun.com examiner', text: item.run.examinerNote, topics: topicsOf(item.run.examinerNote) });

  // ---- candidate NEW mechanics
  const candidateMechanics = [];
  for (const l of commentary) {
    const c = candidateFromLine(l, known);
    if (c) candidateMechanics.push({ source: 'transcript', t: c.t, link: link(id, c.t), quote: c.quote, unseen: c.unseen, nearestKnown: c.nearestKnown });
  }
  for (const n of textNotes) {
    const c = candidateFromLine({ t: null, text: n.text }, known);
    if (c) candidateMechanics.push({ source: n.where, t: null, link: base.url, quote: c.quote, unseen: c.unseen, nearestKnown: c.nearestKnown, author: n.author });
  }
  if (analysis) for (const a of analysis.anomalies.filter(a => (a.kind === 'faster' && !a.legacy) || a.kind === 'missing-banners')) {
    candidateMechanics.push({ source: 'timing', t: a.t, link: link(id, a.t), quote: a.description, segment: a.segment });
  }

  // ---- frames
  if (videoFile && analysis) {
    for (const [i, a] of analysis.anomalies.entries()) {
      const p = await contactSheet(videoFile, a.t, a.tEnd ?? a.t + 30, path.join(DIRS.frames, id, `anomaly-${i}-seg${a.segment ?? 'x'}.png`));
      a.frames = relFrames(p);
    }
    let n = 0;
    for (const c of candidateMechanics) {
      if (c.t == null || n >= 8) continue;
      const p = await contactSheet(videoFile, Math.max(0, c.t - 2), c.t + 6, path.join(DIRS.frames, id, `cand-${Math.round(c.t)}.png`), 8);
      c.frames = relFrames(p); n++;
    }
  }

  // ---- curated notes (descriptions written after viewing the contact sheets)
  const notes = (await readJson(path.join(OUT, '_notes.json'), {}))[id] || null;
  if (notes?.anomalies && analysis) for (const a of analysis.anomalies) { const d = notes.anomalies[String(a.segment)] || notes.anomalies[a.frames]; if (d) a.observed = d; }
  if (notes?.candidates) for (const c of candidateMechanics) { const d = notes.candidates[String(Math.round(c.t ?? -1))]; if (d) Object.assign(c, d); }

  const run = item.run || null;
  return {
    ...base, status: 'ok',
    title: meta.title, author: meta.author, date: meta.date, videoDuration: meta.duration, kind: item.kind || null,
    from: item.from || [], reference: !!item.reference,
    rank: run?.rank ?? null, runStatus: run?.status ?? (item.reference ? 'reference' : 'unsubmitted'), bracket: run?.bracket ?? null, src: run?.src ?? null,
    statedTime: run?.time ?? statedTime(meta.title), patchAtUpload: patchAt(run?.date || meta.date, ref),
    duration: analysis?.duration ?? null,
    offset: analysis?.offset ?? null, offsetMethod: analysis?.offsetMethod ?? null,
    splits: analysis?.splits ?? [], videoSplits: analysis?.videoSplits ?? [], segmentTimes: analysis?.segmentTimes ?? [],
    segmentRef: ref.segs.map(s => ({ name: s.name, min: s.min, median: s.median, max: s.max, best: s.best.runner, checkpoints: s.checkpoints.map(c => c.id) })),
    anomalies: analysis?.anomalies ?? [], blackouts: analysis?.blackouts ?? [], events: analysis?.events ?? null,
    commentary, textNotes: textNotes.slice(0, 60), candidateMechanics,
    transcriptSource, transcriptLines: tr?.lines?.length || 0, transcriptRetry: (!!m.subsError || !!visual.whisperError) && (!tr || tr.source.startsWith('kb-raw')), ...(m.subsError ? { subsError: m.subsError } : {}),
    quality: { visual: visual.status, ...(visual.reason ? { visualReason: visual.reason } : {}), ...(visual.whisperError ? { whisperError: visual.whisperError } : {}), ...(visual.whisperSkipped ? { whisperSkipped: visual.whisperSkipped } : {}), ...(analysis?.quality || {}), transcript: transcriptSource, notes: analysis?.notes || [] },
    curated: notes ? { summary: notes.summary || null } : null,
  };
}

// ---------- markdown ----------
export function toMarkdown(r) {
  const L = [];
  L.push(`# ${r.title || r.id}`, '', `- **Video:** ${r.url}`, `- **Author:** ${r.author || '—'} · ${r.date || ''} · ${r.videoDuration ? fmt(r.videoDuration) : ''}`);
  L.push(`- **Status:** ${r.runStatus || '—'}${r.rank ? ` (rank ${r.rank}, ${r.bracket})` : ''}${r.statedTime ? ` · stated ${fmt(r.statedTime)}` : ''}`);
  L.push(`- **Measured:** ${r.duration != null ? fmt(r.duration) : '—'} · offset ${r.offset ?? '—'} s (${r.offsetMethod || 'no run start'})`);
  L.push(`- **Transcript:** ${r.transcriptSource} (${r.transcriptLines} lines) · visual: ${r.quality?.visual}${r.quality?.visualReason ? ` (${r.quality.visualReason})` : ''}`);
  L.push(`- **Reviewed:** ${r.reviewedAt} (${r.level})`, '');
  if (r.curated?.summary) L.push('## Summary', '', r.curated.summary, '');
  if (r.splits?.length) {
    L.push('## Splits', '', '| Split | Run time | Video | Segment | Ref min / median / max |', '|---|---|---|---|---|');
    r.splits.forEach((s, k) => {
      const ref = r.segmentRef[k] || {};
      L.push(`| ${ref.name || 'End'} | ${fmt(s)} | [${r.videoSplits[k]}](${link(r.id, r.videoSplits[k])}) | ${r.segmentTimes[k] != null ? r.segmentTimes[k].toFixed(2) : '—'} | ${ref.min ?? ''} / ${ref.median ?? ''} / ${ref.max ?? ''} |`);
    });
    L.push('');
  }
  if (r.quality?.notes?.length) L.push(...r.quality.notes.map(n => `> ${n}`), '');
  if (r.anomalies?.length) {
    L.push('## Anomalies', '');
    for (const a of r.anomalies) L.push(`- [${fmt(a.t)}](${link(r.id, a.t)}) ${a.description}${a.observed ? `\n  - **Seen in frames:** ${a.observed}` : ''}${a.frames ? `\n  - frames: \`${a.frames}\`` : ''}`);
    L.push('');
  }
  if (r.blackouts?.length) L.push('## Black screens inside the run', '', r.blackouts.map(b => `[${b.t}s](${link(r.id, b.t)}) ${b.dur}s (split ${b.segment != null ? b.segment + 1 : '?'})`).join(' · '), '');
  if (r.candidateMechanics?.length) {
    L.push('## Candidate new mechanics', '');
    for (const c of r.candidateMechanics) L.push(`- ${c.t != null ? `[${fmt(c.t)}](${c.link})` : c.source}: “${clip(c.quote, 240)}”${c.unseen?.length ? ` — unseen words: ${c.unseen.join(', ')}` : ''}${c.nearestKnown ? ` — nearest known: ${c.nearestKnown.name}` : ''}${c.verdict ? `\n  - **Verdict:** ${c.verdict}` : ''}${c.frames ? `\n  - frames: \`${c.frames}\`` : ''}`);
    L.push('');
  }
  if (r.commentary?.length) {
    L.push('## Commentary (technique lines)', '');
    for (const c of r.commentary.slice(0, 120)) L.push(`- [${fmt(c.t)}](${c.link}) ${clip(c.text, 200)} _(${c.topics.join(', ')})_`);
    L.push('');
  }
  if (r.textNotes?.length) {
    L.push('## Description, comments, speedrun.com', '');
    for (const n of r.textNotes.slice(0, 40)) L.push(`- **${n.where}${n.author ? ` · ${n.author}` : ''}:** ${clip(n.text, 300).replace(/\n/g, ' ')}`);
    L.push('');
  }
  L.push('_Generated by scripts/review/run.mjs. Frame paths are relative to the local frames directory (D:\\claude-temp\\review\\frames)._', '');
  return L.join('\n');
}

export async function writeReview(r) {
  await writeJson(path.join(OUT, `${r.id}.json`), r);
  if (r.status === 'ok') await writeText(path.join(DOCS, `${r.id}.md`), toMarkdown(r));
}

export async function writeIndex() {
  const files = (await readdir(OUT)).filter(f => /^[\w-]{11}\.json$/.test(f));
  const rows = [];
  for (const f of files) {
    const r = await readJson(path.join(OUT, f), null);
    if (!r) continue;
    rows.push({ id: r.id, title: r.title || null, author: r.author || null, status: r.status, runStatus: r.runStatus || null, rank: r.rank ?? null, level: r.level,
      duration: r.duration ?? null, statedTime: r.statedTime ?? null, splits: r.splits || [], complete: !!r.quality?.complete, transcript: r.transcriptSource || null,
      anomalies: (r.anomalies || []).length, candidates: (r.candidateMechanics || []).length, commentary: (r.commentary || []).length, reviewedAt: r.reviewedAt, error: r.error || undefined });
  }
  rows.sort((a, b) => (a.duration ?? 1e9) - (b.duration ?? 1e9));
  const idx = { generatedAt: now(), count: rows.length, ok: rows.filter(r => r.status === 'ok').length, complete: rows.filter(r => r.complete).length, rows };
  await writeJson(path.join(OUT, 'index.json'), idx);
  const md = ['# Raid source reviews', '', `${idx.ok} reviewed · ${idx.complete} with all five splits measured · generated ${idx.generatedAt}`, '',
    '| Video | Author | Status | Measured | Splits | Anomalies | Candidates | Transcript |', '|---|---|---|---|---|---|---|---|',
    ...rows.filter(r => r.status === 'ok').map(r => `| [${clip(r.title || r.id, 60).replace(/\|/g, '/')}](${r.id}.md) | ${r.author || ''} | ${r.runStatus || ''}${r.rank ? ' #' + r.rank : ''} | ${r.duration != null ? fmt(r.duration) : '—'} | ${r.splits.length} | ${r.anomalies} | ${r.candidates} | ${r.transcript || ''} |`),
    '', '## Not reviewable', '', ...rows.filter(r => r.status !== 'ok').map(r => `- ${r.id}: ${r.status} — ${r.error || ''}`), ''];
  await writeText(path.join(DOCS, 'index.md'), md.join('\n'));
  return idx;
}
