// LiveSplit .lss import / export.
// Export carries your PB, golds, attempt + segment history AND every reference
// run as a custom comparison, so LiveSplit can show "−2.4 vs TexasPete" live
// while you play (browsers cannot receive global hotkeys while the game has focus).

const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

export function toLssTime(s) {
  if (s == null || !isFinite(s)) return null;
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s - hh * 3600 - mm * 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss.toFixed(7).padStart(10, '0')}`;
}
export function fromLssTime(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(?:(\d+)\.)?(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (+(m[1] || 0)) * 86400 + (+m[2]) * 3600 + (+m[3]) * 60 + parseFloat(m[4]);
}

const rt = s => (s == null ? '' : `<RealTime>${toLssTime(s)}</RealTime>`);

// timer: store.timer, names: split names, comparisons: [{name, splits:[cumulative]}]
export function exportLss({ names, timer, comparisons, game = 'Runescape: Dragonwilds', category = 'Raid', version = '1.0.0.6+' }) {
  const attempts = timer.attempts || [];
  const pb = timer.pb;
  const fmtDate = d => { const x = new Date(d); return `${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}/${x.getFullYear()} ${x.toTimeString().slice(0, 8)}`; };
  const attemptXml = attempts.map((a, i) => `    <Attempt id="${i + 1}" started="${fmtDate(a.at)}" isStartedSynced="False" ended="${fmtDate(a.at + (a.time || a.splits.filter(x => x != null).pop() || 0) * 1000)}" isEndedSynced="False">${a.done ? rt(a.time) : ''}</Attempt>`).join('\n');
  const segXml = names.map((name, k) => {
    const st = [];
    if (pb) st.push(`        <SplitTime name="Personal Best">${rt(pb.splits[k])}</SplitTime>`);
    for (const c of comparisons) st.push(`        <SplitTime name="${esc(c.name)}">${rt(c.splits[k])}</SplitTime>`);
    const hist = attempts.map((a, i) => {
      const cur = a.splits[k], prev = k ? a.splits[k - 1] : 0;
      if (cur == null || prev == null) return '';
      return `        <Time id="${i + 1}">${rt(cur - prev)}</Time>`;
    }).filter(Boolean).join('\n');
    return `    <Segment>
      <Name>${esc(name)}</Name>
      <Icon />
      <SplitTimes>
${st.join('\n')}
      </SplitTimes>
      <BestSegmentTime>${rt(timer.best[k])}</BestSegmentTime>
      <SegmentHistory>${hist ? '\n' + hist + '\n      ' : ''}</SegmentHistory>
    </Segment>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Run version="1.7.0">
  <GameIcon />
  <GameName>${esc(game)}</GameName>
  <CategoryName>${esc(category)}</CategoryName>
  <LayoutPath>
  </LayoutPath>
  <Metadata>
    <Run id="" />
    <Platform usesEmulator="False">PC</Platform>
    <Region>
    </Region>
    <Variables>
      <Variable name="Game Type">Scorned Wilderness</Variable>
      <Variable name="Version Range">${esc(version)}</Variable>
    </Variables>
  </Metadata>
  <Offset>00:00:00</Offset>
  <AttemptCount>${attempts.length}</AttemptCount>
  <AttemptHistory>
${attemptXml}
  </AttemptHistory>
  <Segments>
${segXml}
  </Segments>
  <AutoSplitterSettings />
</Run>
`;
}

// Returns { names, pb:{splits,time}|null, best:[], attempts:[{at, splits:[cumulative|null], time, done}], comparisons:{name:[...]} }
export function importLss(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('Run > Segments')) throw new Error('Not a LiveSplit .lss file');
  const realTime = el => (el ? fromLssTime((el.querySelector('RealTime') || {}).textContent) : null);
  const segs = [...doc.querySelectorAll('Run > Segments > Segment')];
  const names = segs.map(s => s.querySelector('Name').textContent.trim());
  const comparisons = {};
  const pbSplits = segs.map(s => realTime([...s.querySelectorAll('SplitTimes > SplitTime')].find(x => x.getAttribute('name') === 'Personal Best')));
  segs.forEach((s, k) => s.querySelectorAll('SplitTimes > SplitTime').forEach(x => {
    const n = x.getAttribute('name');
    if (n === 'Personal Best') return;
    (comparisons[n] ||= Array(segs.length).fill(null))[k] = realTime(x);
  }));
  const best = segs.map(s => realTime(s.querySelector('BestSegmentTime')));
  const attemptEls = [...doc.querySelectorAll('Run > AttemptHistory > Attempt')];
  const parseDate = s => { const d = s ? Date.parse(s) : NaN; return isNaN(d) ? Date.now() : d; };
  const hist = segs.map(s => Object.fromEntries([...s.querySelectorAll('SegmentHistory > Time')].map(t => [t.getAttribute('id'), realTime(t)])));
  const attempts = attemptEls.map(a => {
    const id = a.getAttribute('id');
    let acc = 0; const splits = [];
    for (let k = 0; k < segs.length; k++) {
      const seg = hist[k][id];
      if (seg == null || acc == null) { splits.push(null); acc = null; continue; }
      acc += seg; splits.push(acc);
    }
    const time = realTime(a);
    return { at: parseDate(a.getAttribute('started')), splits, time, done: time != null };
  });
  const complete = pbSplits.every(x => x != null);
  return { names, pb: complete ? { splits: pbSplits, time: pbSplits[pbSplits.length - 1] } : null, best, attempts, comparisons, game: (doc.querySelector('Run > GameName') || {}).textContent, category: (doc.querySelector('Run > CategoryName') || {}).textContent };
}
