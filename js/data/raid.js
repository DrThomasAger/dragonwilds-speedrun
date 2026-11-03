// Scorned Wilderness raid: splits, reference runs, route, patch history.
//
// HOW THE SPLIT MARKS WERE MEASURED (2026-11-02) — summary: every split below is
// placed on the same visual trigger (see TRIGGER) found by template matching at
// 10 fps then checked frame by frame; offsets come from reading the on-screen timer
// at 3+ frames. Original notes:
// TexasPete and Nanobit both run LiveSplit on screen with the community split
// file (Dragontail Vines → Fragments of Ghornfell → The Shattered Stronghold →
// Cataclysm Keep → Kuldra's Sanctum). For each video:
//   offset  = video second at which the LiveSplit timer reads 0, measured by
//             reading the timer at 3+ frames across the run (agreement ±0.02 s).
//   splits  = run-timer value at each split. TexasPete's were detected from the
//             frame where LiveSplit's highlight row moves (±0.1 s). Nanobit's are
//             the whole-second values printed on his final split panel, placed at
//             the middle of that second (±0.5 s).
// Runs without an on-screen splits panel were marked by locating each Crystallized
// Anima pickup (the split trigger) frame-by-frame; precision is stated per run.
// Any mark can be corrected in the app (Race the WR → Adjust marks) and exported.

export const SPLITS = [
  { name: 'Dragontail Vines', short: 'Vines' },
  { name: 'Fragments of Ghornfell', short: 'Fragments' },
  { name: 'The Shattered Stronghold', short: 'Stronghold' },
  { name: 'Cataclysm Keep', short: 'Keep' },
  { name: "Kuldra's Sanctum", short: 'Sanctum' },
];
// Splits 1-4 = first frame the "EXTRACTION POINT UNLOCKED" banner text shows.
// Split 5 = the cut to black after "GET OUT NOW!" (speedrun.com end rule).
export const TRIGGER = ['Extraction point unlocked banner', 'Extraction point unlocked banner', 'Extraction point unlocked banner', 'Extraction point unlocked banner', 'Cut to black after GET OUT NOW!'];

export const RULES = {
  start: 'Timer starts on the first frame the loading icon disappears going into the raid.',
  end: 'Timer ends on the frame the screen goes black after the "Get out now!" timer ends after defeating Kuldra\'s Heart.',
  video: 'Video required; runs are verified by moderators. Real time, milliseconds shown.',
  link: 'https://www.speedrun.com/Runescape_Dragonwilds',
};

export const SRC = { game: '2689lo91', category: 'xd19vy4k', versionVar: 'rn163418', versionNew: '1gn0epol', versionOld: 'qzn2v3kq', board: 'https://www.speedrun.com/Runescape_Dragonwilds?h=Raid-Scorned-Wilderness-1.0.0.6' };

// Raid category, 1.0.0.6+ bracket, as fetched from the speedrun.com API on 2026-11-02.
export const SRC_SNAPSHOT = {
  at: '2026-11-02T17:20:00Z',
  rows: [
    { place: 1, players: ['TexasPete'], t: 410, date: '2026-10-14', id: 'm74jw34m', video: 'https://www.youtube.com/watch?v=6WEIHo7AUf0' },
    { place: 2, players: ['Nanobit'], t: 421, date: '2026-10-17', id: 'm74v4p4m', video: 'https://www.youtube.com/watch?v=doVQ9Ph256g' },
    { place: 3, players: ['Nimblesk'], t: 508, date: '2026-10-09', id: 'mrpdw24z', video: 'https://youtu.be/lfl8AtveRJI' },
    { place: 4, players: ['ChiefWes'], t: 583, date: '2026-10-09', id: 'y2488pjz', video: 'https://www.youtube.com/watch?v=RFY6kDdxHOg' },
    { place: 5, players: ['KawaiiXO'], t: 1572, date: '2026-10-07', id: 'z54wpegm', video: 'https://youtu.be/IspjMuF94Iw' },
  ],
};

// Reference runs with frame-measured split marks. `splits` are cumulative run-timer seconds.
export const RUNS = [
  { key: 'tp650', runner: 'TexasPete', label: 'TexasPete 6:50 (WR)', vid: '6WEIHo7AUf0', offset: 7.38, time: 410.0,
    splits: [81.52, 142.62, 194.32, 290.62, 410.0], precision: '±0.1 s', src: 'm74jw34m', patch: '1.0.0.6+ (pre-1.0.1 strats)', date: '2026-10-14',
    moments: [[115.0, '“Where all runs go to die.”'], [259.8, '“Here at the needle.”'], [320.9, "“I'm going to risk it all — going for the big jumps.”"]] },
  { key: 'nano701', runner: 'Nanobit', label: 'Nanobit 7:01', vid: 'doVQ9Ph256g', offset: 23.78, time: 421.97,
    splits: [87.82, 154.92, 218.02, 305.82, 421.97], precision: '±0.1 s', src: 'm74v4p4m', patch: '1.0.1 / 1.0.1.1', date: '2026-10-16', sob: 411 },
  { key: 'tp740', runner: 'TexasPete', label: 'TexasPete 7:40', vid: '6N3NwYA5Zh0', offset: 29.55, time: 460.62,
    splits: [89.95, 168.55, 222.95, 324.75, 460.62], precision: '±0.1 s', patch: '1.0.0.6+', date: '2026-10-10',
    note: 'On-screen timer was stopped early at 7:39.94; final split here is the measured cut to black.' },
  { key: 'nimble828', runner: 'Nimblesk', label: 'Nimblesk 8:28', vid: 'lfl8AtveRJI', offset: -0.15, time: 508.75,
    splits: [100.75, 178.95, 237.45, 336.05, 508.75], precision: '±0.1 s', src: 'mrpdw24z', patch: '1.0.0.6+', date: '2026-10-09' },
  { key: 'wes937', runner: 'ChiefWes', label: 'ChiefWes 9:37', vid: 'RFY6kDdxHOg', offset: 15.27, time: 577.33,
    splits: [119.93, 209.33, 270.93, 396.83, 577.33], precision: '±0.1 s', src: 'y2488pjz', patch: '1.0.0.6+', date: '2026-10-09', note: 'speedrun.com lists 9:43.' },
  { key: 'samf11', runner: 'SamFPlays', label: 'SamFPlays 10:53 (1.0.1 follow-along)', vid: 'WpvNjqVmpVM', offset: -0.1, time: 653.4,
    splits: [115.2, 212.5, 312.8, 481.4, 653.4], precision: '±0.1 s', patch: '1.0.1', date: '2026-10-14' },
];

export const RECORD = { runner: 'TexasPete', time: 410.0, key: 'tp650' };
export const RUN = Object.fromEntries(RUNS.map(r => [r.key, r]));
export const COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

// Best segment per split across reference runs ("community sum of best").
export function communityBest(runs = RUNS) {
  return SPLITS.map((_, k) => {
    let best = null;
    for (const r of runs) {
      const seg = r.splits[k] - (k ? r.splits[k - 1] : 0);
      if (!best || seg < best.seg) best = { seg, run: r.key, runner: r.runner, from: k ? r.splits[k - 1] : 0, to: r.splits[k] };
    }
    return best;
  });
}

// Patch history relevant to routing. Sources in `src` (video keys from videos.js).
// Patch history relevant to routing. `quote` is verbatim from the official Steam
// patch notes (`url`); `text` adds what the community found. Sources in `src`.
export const PATCHES = [
  { v: '1.0', date: '2026-09-15', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1843481262704158', quote: 'Added the Scorned Wilderness region… Added new end-game boss, Kuldra, the God-Eater!', text: 'Raid released. Load-zone extraction skip lets runners leave the map and reach the Heart (CrossRSDW). Sub-4 runs follow.', src: ['cross1'] },
  { v: '1.0.0.5', date: '2026-09-26', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1844751498218499', quote: 'Dying in the Scorned Wilderness Raid will no longer skip a respawn point. AI will now respawn as intended on starting the second Scorned Wilderness Raid attempt.', text: 'Death-based respawn skips closed.', src: [] },
  { v: '1.0.0.6', date: '2026-09-29', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1844751498233777', text: 'Extraction skip patched; speedrun.com splits the board into Pre 1.0.0.6 and 1.0.0.6+. CrossRSDW finds new Vines, jump-puzzle and Stronghold skips plus a Kuldra skip.', src: ['cross2', 'tigerskip'] },
  { v: '1.0.0.6+', date: '2026-10-09', text: 'ChiefWes 9:43 sets the 1.0.0.6+ record; TexasPete 7:40 (10 Oct), then 6:50 (14 Oct).', src: ['wes937', 'tp740', 'tp650'] },
  { v: '1.0.1', date: '2026-10-14', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1846651706673783', quote: 'Fixed several Windstep-related skips in the Scorned Wilderness Raid. Obstacles and Enemies now respawn in the Scorned Wildnerness Raid on reset/next run-through. Fixed an issue where users could clip through the floor when teleporting to Cataclysm Keep from Commander Zilyana.', text: 'Same day: Dotxy\'s dive/plunge cancel; Sir_Rebral\'s Garou Thane route; IINo1goodII/notmusty1 find a hole in the Keep. Nanobit 8:32 → 7:01.', src: ['samf11', 'dotxycancel', 'nano832', 'nano701'] },
  { v: '1.0.1.1', date: '2026-10-15', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1846651706678658', quote: 'Fixes for skips in the Scorned Wilderness Raid.', text: 'Hotfix; Nanobit\'s 7:01 is on 1.0.1/1.0.1.1.', src: ['nano701'] },
  { v: '1.0.1.2', date: '2026-10-23', url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1847286114035869', quote: 'Additional fixes for Kuldra Skips.', text: 'Windstepping up the blocks to Kuldra no longer works (Nanobit). Dotxy flies through the Sanctum with chained jump-attack cancels the same day. FastTipsGaming reports a working fight skip on 27 Oct — verify before routing.', src: ['dotxyflight', 'dotxyjump', 'ftgskip'] },
];

// "Beat 6:50" target pace — measured, not spread evenly. Built skip by skip from
// the four record runs using only pieces that still work on patch 1.0.1.2
// (docs/runpath.md, data/kb/runpath.json, 2026-11-03): level with the WR through
// split 3, about 8 s ahead after the 1.0.1 Keep hole, then a 49 s Sanctum flight
// (Dotxy) and a first-try heart safespot. Valid composite of shown pieces: 6:52.8.
export const TARGET_TIME = 408.1;   // 6:48.1
export const TARGET_SPLITS = [82.7, 143.2, 195.7, 282.3, 408.1];
export function targetPace() { return TARGET_SPLITS.slice(); }
export const VALID_COMPOSITE = 412.8;  // 6:52.8 — best possible from pieces already shown on 1.0.1.2
