// Re-verifies every video id in the library against YouTube oEmbed.
//   npm run check
import { VIDEOS } from '../js/data/videos.js';
let bad = 0;
for (const v of VIDEOS) {
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${v.id}`);
  const ok = r.ok;
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'DEAD', v.id, v.author, '—', v.title);
}
console.log(bad ? `${bad} dead video(s)` : `all ${VIDEOS.length} videos live`);
process.exit(bad ? 1 : 0);
