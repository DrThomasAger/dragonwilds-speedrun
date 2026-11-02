// Video library. Every id, title, creator, duration and chapter list below was
// read from the live YouTube watch page on 2026-11-02 (scripts/check-data.mjs
// re-verifies ids). Durations are seconds. Chapters are the creator's own.
//
// kind: record | run | guide | tech | boss | vault | misc | pvp

const V = (id, o) => ({ id, ...o });

export const VIDEOS = [
  // ---------- Raid runs (speedrun.com Raid category) ----------
  V('6WEIHo7AUf0', { key: 'tp650', kind: 'record', title: 'Speedrun WR (6:50) Kuldra RAID w/ Commentary', author: 'TexasPete', dur: 444.3, date: '2026-10-23', patch: '1.0.0.6+',
    note: 'Current #1 in the 1.0.0.6+ bracket. Recorded 14 Oct, before the windstep double jump. Nanobit notes some of its strats have since been patched.' }),
  V('doVQ9Ph256g', { key: 'nano701', kind: 'record', title: '7:01 Kuldra | 1.0.1/1.0.1.1 Legacy WR', author: 'Nanobit', dur: 464.9, date: '2026-10-16', patch: '1.0.1–1.0.1.1',
    note: 'Fastest run on the 1.0.1 ruleset. Sum of best 6:51 after 177 attempts. Windstepping up the blocks to Kuldra stopped working in 1.0.1.2.' }),
  V('6N3NwYA5Zh0', { key: 'tp740', kind: 'record', title: '(7:40) Kuldra RAID Speedrun // Patch 1.0.0.6+', author: 'TexasPete', dur: 526.2, date: '2026-10-10', patch: '1.0.0.6+',
    note: 'Former WR. Stays in the map and completes the Cataclysm Keep puzzle. Clock stopped ~0.9 s early (true time ≈ 7:40.84).' }),
  V('lfl8AtveRJI', { key: 'nimble828', kind: 'record', title: 'Raid 8:28', author: 'Nimblesk', dur: 519.8, date: '2026-10-09', patch: '1.0.0.6+',
    note: '“Made some monumental mistakes… positive I can hit a sub 8.”' }),
  V('RFY6kDdxHOg', { key: 'wes937', kind: 'record', title: 'Scorned Wilderness speed run WORLD RECORD (9:37)', author: 'ChiefWes', dur: 603.1, date: '2026-10-09', patch: '1.0.0.6+',
    note: 'The original 1.0.0.6+ record; speedrun.com lists it at 9:43.' }),
  V('204hBIge5h0', { key: 'wes937tiger', kind: 'run', title: 'Legacy World Record (9:37 ChiefWes) — Scorned Wilderness & Kuldra', author: 'Tiger with the Bars', dur: 578, date: '2026-10-07', patch: '1.0.0.6' }),
  V('vw_Mr5TGJAg', { key: 'nano832', kind: 'run', title: '8:32 Kuldra | 1.0.1 Day 1 Strats', author: 'Nanobit', dur: 543, date: '2026-10-15', patch: '1.0.1',
    note: 'First 1.0.1 route: zoop to necro land, kill the air Garou Thane through the gate, windjump to the air door. Air Thane takes ~15 min to respawn — sleep through a night between attempts.' }),
  V('WpvNjqVmpVM', { key: 'samf11', kind: 'run', title: '11 Min Full Kuldra Speedrun (Post-Patch 1.0.1) — Follow Along', author: 'SamFPlays', dur: 661.9, date: '2026-10-14', patch: '1.0.1',
    chapters: [[0, 'Start'], [18, 'Windstep to air anima'], [40, 'Soulscourge skip'], [77, 'Skip the black dragon'], [95, 'Skip the entire necromancer area'], [160, 'Skip the entire poison area'], [184, 'Surge + phase dash past the abyssal demon'], [220, 'Skip the hardest part of the raid (Garou Thane)'], [320, 'Parkour section made easy'], [360, 'Elemental puzzle'], [505, 'Skip the Kuldra fight in under a minute'], [564, "Kuldra's heart: where to stand (no heartworms)"]] }),
  V('iu2SL4oyZFQ', { key: 'samf10', kind: 'run', title: 'Sub 10 Min Full Kuldra Run — Follow Along (patched)', author: 'SamFPlays', dur: 594, date: '2026-10-02', patch: '1.0.0.6', patched: true,
    chapters: [[0, 'Start'], [20, 'Windstep to air anima'], [40, 'Soulscourge skip (phase dash + food trick)'], [81, 'Skip the black dragon'], [98, 'Skip the necromancer area (2 windsteps)'], [154, 'Skip the poison area'], [184, 'Surge + phase dash past the abyssal demon'], [220, 'Skip the hardest part of the raid'], [278, 'Parkour section made easy'], [321, 'Skip the elemental puzzle (patched)'], [430, 'Skip the Kuldra fight in under a minute'], [503, "Kuldra's heart: where to stand"]] }),
  V('Ukpwi_w-VcE', { key: 'duo831', kind: 'record', title: 'Kuldra Duo World Record (8:31) | 1.0 release', author: 'Special_Atks', dur: 603, date: '2026-09-16', patch: '1.0' }),
  V('pNBJlwJOky8', { key: 'duo948', kind: 'run', title: 'Kuldra Whole Raid 2 Man {09:48}', author: 'RandomGuy', dur: 626, date: '2026-09-17', patch: '1.0' }),
  V('0zLlzP8hc2Y', { key: 'ss327', kind: 'record', title: 'Scorned Wilderness Raid Speedrun 3:27', author: 'ShadowStalkerTM', dur: 232, date: '2026-09-25', patch: 'Pre 1.0.0.6', patched: true,
    note: '#1 in the Pre-1.0.0.6 bracket. Done right before the update that closed the extraction skip.' }),
  V('bJQqgsf2ikk', { key: 'he357', kind: 'record', title: 'Scorned Wilderness Raid Speedrun in 3:57 (Former WR)', author: 'heartlessedly', dur: 272, date: '2026-09-24', patch: 'Pre 1.0.0.6', patched: true }),
  V('hDT7if6f9Ug', { key: 'he502', kind: 'run', title: 'Scorned Wilderness Raid Speedrun in 5:02 (Patched)', author: 'heartlessedly', dur: 348, date: '2026-09-21', patch: 'Pre 1.0.0.6', patched: true }),
  V('sNllJ4Qm6RY', { key: 'lob414', kind: 'run', title: 'Kuldra Raid 4:14 Glitched Any%', author: 'Lobsters', dur: 269, date: '2026-09-21', patch: 'Pre 1.0.0.6', patched: true }),
  V('neLGN1LJlsc', { key: 'logan1330', kind: 'run', title: '13:30 Scorned Wilderness/Kuldra Hard Mode World Record', author: 'Logan', dur: 851, date: '2026-09-24', patch: '1.0' }),
  V('OkRnmVbspdw', { key: 'logan2416', kind: 'run', title: '24:16 World Record Scorned Wilderness/Kuldra (Hard Mode)', author: 'Logan', dur: 1529, date: '2026-09-23', patch: '1.0' }),
  V('s9cyeL2c-qg', { key: 'tsw', kind: 'run', title: 'Fastest Kuldra Run post Patch 1.0.1 — raid skips', author: "That's So Wild Gaming", dur: 668, date: '2026-10-14', patch: '1.0.1' }),
  V('WIOk5DxP7kA', { key: 'david', kind: 'run', title: 'Fastest way to Kuldra | 22:35 | Patch 1.0.1.2', author: 'David The Optimist Gaming', dur: 751, date: '2026-10-26', patch: '1.0.1.2' }),

  // ---------- Skip guides ----------
  V('ESrrkdxD1fo', { key: 'samfguide', kind: 'guide', title: 'Sub 10 Min Kuldra Skip Guide (Post-Patch 1.0.1) — Every Skip Explained', author: 'SamFPlays', dur: 758, date: '2026-10-16', patch: '1.0.1',
    note: 'Gear: Fleet Foot Infusion (must bring, −50% sprint stamina), Strong Tea (+20 Rest), best mace, 2H mage staff for the heart, best mage armour.',
    chapters: [[0, 'Phase Dash & Surge combo'], [103, 'Gear & setup'], [133, 'First air anima'], [151, 'Soulscourge skip'], [190, 'Black dragon skip'], [208, 'Skip the entire Necromancer area'], [260, 'Skip the entire poison area'], [300, 'Abyssal demon skip'], [337, '(NEW) Skip the Garou Thane area'], [447, '(NEW) Elemental puzzle skip'], [558, 'Skip the entire Kuldra fight'], [637, "Where to stand so heartworms don't spawn"]] }),
  V('1HqP4q2WERw', { key: 'samfguideold', kind: 'guide', title: 'Every Kuldra Skip Explained — Sub 10 Min Raid Guide (patched)', author: 'SamFPlays', dur: 1073, date: '2026-10-03', patch: '1.0.0.6', patched: true,
    chapters: [[0, 'Intro & setup'], [60, 'Windstep to air anima'], [120, 'Soulscourge skip (phase dash + food trick)'], [215, 'Skip the black dragon'], [244, 'Skip the necromancer area'], [320, 'Skip the poison area'], [384, 'Surge + phase dash past the abyssal demon'], [434, 'Skip the hardest part of the raid'], [578, 'Parkour section'], [636, 'Skip the entire elemental puzzle'], [795, 'Skip the Kuldra fight'], [936, "Kuldra's heart: where to stand"]] }),
  V('1Q21XYSKJgo', { key: 'zyn', kind: 'guide', title: 'Kuldra Scorned Wilderness Full Raid Skip Guide (Patch 1.0.1)', author: 'zyneater', dur: 1082, date: '2026-10-16', patch: '1.0.1',
    chapters: [[0, 'Intro'], [239, 'Tips for split 0→1'], [396, '0→1 skip'], [431, '1→2 skip'], [542, '2→3 skip'], [685, '3→4 transition / puzzle'], [869, 'Kuldra skip and tips']] }),
  V('lTG0EuXuqDs', { key: 'cross2', kind: 'guide', title: 'Jagex Patched the Raid Skip… So I Broke it Again', author: 'CrossRSDW', dur: 327, date: '2026-09-30', patch: '1.0.0.6',
    chapters: [[0, 'Intro'], [48, 'Dragontail Vines skip'], [103, 'Updated jump puzzle skip'], [141, 'Shattered Stronghold skip'], [238, 'Kuldra skip']] }),
  V('ewgak1mPu7A', { key: 'cross1', kind: 'guide', title: 'I Broke the New Dragonwilds Raid | Kuldra Guide + Tricks', author: 'CrossRSDW', dur: 684, date: '2026-09-20', patch: '1.0',
    chapters: [[0, 'Introduction'], [39, 'Basic prep'], [53, 'Island skip'], [76, 'Urn 1'], [94, 'Jump puzzle skip'], [176, 'Urn 2'], [236, 'Castle skip'], [288, 'Urn 3'], [328, 'Kuldra P1'], [361, 'Kuldra P2'], [432, 'Kuldra P3'], [507, 'Kuldra P4'], [533, '[Patched 9/25] How to skip the raid']] }),
  V('68ovg9A_PpA', { key: 'xero', kind: 'guide', title: 'New raid skips found after update 1.0.1', author: 'Channel Xero', dur: 894, date: '2026-10-16', patch: '1.0.1',
    chapters: [[0, 'Raid introduction and prep'], [93, 'Early raid skips and combat'], [262, 'Mid-raid boss strategies'], [439, 'Advanced movement and pathing'], [623, 'Final boss and raid exit'], [800, 'Post-raid review']] }),
  V('7s3fgHwlRYA', { key: 'stooobraid', kind: 'guide', title: 'How to Beat Kuldra — Complete Raid Guide', author: 'SuperStooob', dur: 1235, date: '2026-09-15', patch: '1.0',
    chapters: [[0, 'Kuldra raid guide'], [46, 'Preparation & what to bring'], [158, 'How raid checkpoints work'], [205, 'Runite, vis cloth & new materials'], [299, 'Dragontail Vines'], [408, 'Anima orbs explained'], [450, 'Fragments of Ghornfell'], [529, 'Maze & poison section'], [640, 'Plague King & Abyssal Demon'], [707, 'Shattered Stronghold'], [781, 'Cataclysm Keep'], [802, 'Four anima pylon puzzle'], [873, 'Air, water, earth, fire solution'], [885, 'Kuldra boss fight'], [1007, 'Kuldra phase 2'], [1035, 'Kuldra phase 3'], [1071, 'Inside Kuldra — final phase'], [1163, 'Kuldra rewards & dragon gear'], [1208, 'Final thoughts']] }),
  V('2Zn04m-mq80', { key: 'tigerskip', kind: 'guide', title: 'Legacy Kuldra Skip with a Shortcut to the Heart', author: 'Tiger with the Bars', dur: 45, date: '2026-09-23', patch: '1.0.0.6', note: 'Credit: Zilko.' }),
  V('L-dTDXJyFq0', { key: 'ftgskip', kind: 'guide', title: 'UNPATCHED Kuldra Raid Fight SKIP', author: 'FastTipsGaming', dur: 330, date: '2026-10-27', patch: '1.0.1.x' }),

  // ---------- Movement tech ----------
  V('GeWbo4GpFEg', { key: 'dotxyflight', kind: 'tech', title: "NEW Kuldra Skip (1.0.1.2) — fly through Kuldra's Sanctum", author: 'Dotxy', dur: 90.5, date: '2026-10-23', patch: '1.0.1.2',
    note: 'Loop: Windstep → Jump Attack → Q (spell ring) → any targeted AoE spell → Esc → Jump, repeat from Jump Attack. Not in any posted record yet.' }),
  V('goKfbT19nkk', { key: 'dotxyjump', kind: 'tech', title: '1.0.1 New Movement Tech — Infinite Double Jump', author: 'Dotxy', dur: 45, date: '2026-10-21', patch: '1.0.1',
    note: 'Chain the jump-attack cancel into another air jump, then another jump attack. Fast inputs gain height instead of hovering.' }),
  V('LGCddmk_TnM', { key: 'dotxycancel', kind: 'tech', title: '1.0.1 New Movement Tech — Dive Cancel', author: 'Dotxy', dur: 51, date: '2026-10-14', patch: '1.0.1',
    note: 'Cast a targeted AoE spell during the jump-attack animation, then cancel the cast — full movement instantly. Works off Windstep and double jump.' }),
  V('U0_KPXu28qw', { key: 'ftgjump', kind: 'tech', title: 'Infinite Jump EXPLOIT 1.0', author: 'FastTipsGaming', dur: 241, date: '2026-10-26', patch: '1.0.1.x' }),
  V('RPswUj5XG8Y', { key: 'lavawr', kind: 'tech', title: '[WORLD RECORD] Lava Fields 50.69', author: 'Gidster', dur: 60, date: '2026-09-06', patch: '1.0' }),
  V('zXT7fKFf7Xw', { key: 'ghornagi', kind: 'tech', title: 'Ghornfell Agility Course Gold Medal Guide (KBM & Controller)', author: 'Nerdy But Deadly', dur: 209, date: '2026-10-09', patch: '1.0' }),

  // ---------- Bosses ----------
  V('AbC4uyQRzcM', { key: 'bosses', kind: 'boss', title: 'How to Beat EVERY Boss in RuneScape: Dragonwilds', author: 'SuperStooob', dur: 1290, date: '2026-10-01', patch: '1.0',
    chapters: [[0, 'First-kill guide: what to expect'], [39, 'Velgar: gear and food'], [85, 'Velgar: fight strategy'], [173, 'Sponsor segment'], [216, 'Imaru: gear and healing'], [281, 'Imaru: attacks and phases'], [501, 'Black Knight Titan: ranged setup'], [548, 'Black Knight Titan: fight strategy'], [689, 'Fuzan: gear, food and supplies'], [773, 'The 10-wave Fight Cave'], [806, 'Fuzan: pillar positioning and attacks'], [866, 'Fuzan: pizza mechanic and thralls'], [913, 'Fuzan: charges and tracking dragonfire'], [991, 'Kuldra: first-clear setup'], [1041, 'Kuldra: head attacks and Hyperbeam'], [1117, 'Kuldra: Anima, pylons and cannon stages'], [1228, 'Kuldra: destroying the heart'], [1269, 'Final tips']] }),
  V('-rkmjIK1EeI', { key: 'velgar86', kind: 'boss', title: 'Velgar Dies in 86 Seconds Flat | Solo Kill', author: 'YodatheGIANT', dur: 93, date: '2025-04-20', patch: 'EA' }),
  V('REVKfEpm1C0', { key: 'velgarguide', kind: 'boss', title: "Don't Fight Velgar Until You Do This! | Boss Guide", author: 'Tiger with the Bars', dur: 218, date: '2026-09-15', patch: '1.0' }),
  V('1zFMo7ZzZOc', { key: 'velgar2h', kind: 'boss', title: "Can We Beat Dragonwilds' First Dragon in Just 2 Hours?", author: 'SuperStooob', dur: 1577, date: '2026-10-25', patch: '1.0.1',
    chapters: [[0, 'Two hours. One dragon.'], [24, 'The clock starts'], [57, 'An expertly planned disaster'], [165, 'Someone forgot something'], [285, 'Progress comes at a price'], [322, 'The run hits a wall'], [465, 'One small mistake…'], [508, 'The heist of the century'], [746, "We're still not ready"], [868, "Something isn't right"], [958, 'Ready or not'], [1135, 'Every second counts'], [1306, 'We want this so badly'], [1444, 'Catching our breath'], [1493, 'Surely we’re finished?']] }),

  // ---------- Vaults ----------
  V('cLC3khNU1_Q', { key: 'vaultN', kind: 'vault', title: 'Complete Guide to Temple Woods North Vault', author: 'MetaForge', dur: 754, date: '2025-04-22', patch: 'EA',
    chapters: [[0, 'Intro'], [8, 'Vault location'], [144, 'Vault entrance'], [207, 'Chest 1'], [248, 'Vault core 1 and chest 2'], [310, 'Secret passage'], [327, 'Altar and chest 3'], [403, 'Chest 4'], [494, 'Chest 5'], [536, 'Chest 6'], [579, 'Vault core 2'], [650, 'Boss'], [702, 'Final vault core 3'], [714, 'Final chest 7'], [718, 'Outro']] }),
  V('lF9h8FaQx44', { key: 'vaultS', kind: 'vault', title: 'Complete Guide to Temple Woods South Vault', author: 'MetaForge', dur: 432, date: '2025-04-21', patch: 'EA',
    chapters: [[0, 'Intro'], [25, 'Vault location'], [65, 'Vault entrance'], [135, 'Chest 1'], [189, 'Vault core 1 and chest 2'], [246, 'Lever for chest 3'], [274, 'Chest 3'], [294, 'Secret path'], [306, 'Vault core 2 and chest 4'], [324, 'Boss room lever'], [340, 'Boss'], [390, 'Vault core 3'], [397, 'Chest 5'], [425, 'Outro']] }),
  V('9pdhP9cHL1Y', { key: 'vaultHidden', kind: 'vault', title: 'Unlock the Temple Woods Vault Hidden Chamber', author: 'Mature Minded Gamers', dur: 65, date: '2025-04-20', patch: 'EA' }),
  V('4atswj1YzUE', { key: 'vaultGate', kind: 'vault', title: 'How To Open The Final Locked Gate Inside The Temple Woods Vault', author: 'WEDZGAMING', dur: 161, date: '2026-09-13', patch: '1.0' }),

  // ---------- Long-form / misc ----------
  V('Z7N5NKvNTGM', { key: 'roasty', kind: 'misc', title: 'How I got the WORLD RECORD Speedrun in Runescape: Dragonwilds', author: 'ItsRoasty', dur: 7917, date: '2025-04-23', patch: 'EA' }),
  V('683KRPSLsPs', { key: 'days100', kind: 'misc', title: "I Spent 100 Days in RuneScape Dragonwilds… Here's What Happened!", author: 'Rised', dur: 4791, date: '2026-09-12', patch: '1.0' }),
  V('9_TobOJT3s8', { key: 'pvp1h', kind: 'pvp', title: 'We Had 1 Hour to Prepare for a RuneScape: Dragonwilds PvP Battle!', author: 'Game Advisor', dur: 1268, date: '2026-10-03', patch: '1.0',
    chapters: [[0, 'Intro and rules'], [60, 'Challenge begins'], [784, 'Arena PvP 1'], [1010, 'Arena PvP 2'], [1114, 'Arena PvP 3'], [1222, 'Outro']] }),
];

export const KIND_LABEL = { record: 'Record runs', run: 'Full runs', guide: 'Skip guides', tech: 'Movement tech', boss: 'Bosses', vault: 'Vaults', misc: 'Long-form', pvp: 'PvP' };

export const BY_KEY = Object.fromEntries(VIDEOS.map(v => [v.key, v]));
export const BY_ID = Object.fromEntries(VIDEOS.map(v => [v.id, v]));
export const video = k => BY_KEY[k] || BY_ID[k];

// Chapter list → [{t0, t1, label}] with t1 = next chapter or end of video.
export function chapterClips(v) {
  if (!v.chapters) return [];
  return v.chapters.map(([t, label], i) => ({ vid: v.id, in: t, out: i + 1 < v.chapters.length ? v.chapters[i + 1][0] : v.dur, label }));
}
