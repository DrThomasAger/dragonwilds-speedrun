// Current-patch raid route (1.0.1.2). Each skip cites the creator who found or
// documented it; clip ranges are creator chapters or measured split marks.
import { RUN, SPLITS } from './raid.js';

const C = (vid, a, b, label) => ({ vid, in: a, out: b, label });
const SAMF_RUN = 'WpvNjqVmpVM', SAMF_GUIDE = 'ESrrkdxD1fo', ZYN = '1Q21XYSKJgo', CROSS = 'lTG0EuXuqDs';
const seg = (key, k, label) => { const r = RUN[key]; return C(r.vid, +(r.offset + (k ? r.splits[k - 1] : 0)).toFixed(2), +(r.offset + r.splits[k]).toFixed(2), label || `${r.runner} ${r.key === 'tp650' ? '6:50' : r.key === 'nano701' ? '7:01' : '7:40'} — whole split`); };

export const GEAR = [
  ['Fleet Foot Infusion', 'must bring — halves sprint stamina cost (SamFPlays).'],
  ['Strong Tea', '+20 Rest; nice to have.'],
  ['Best mace', 'melee for the Air Garou Thane kill through the gate.'],
  ['2H mage staff', 'burns Kuldra\'s Heart at the end.'],
  ['Best mage armour', 'the heart phase is a DPS check.'],
  ['Windstep, Surge, Phase Dash, a targeted AoE spell', 'the movement kit every skip is built from; the AoE spell powers the dive cancel.'],
];

// Skips placed into splits by where SamFPlays' chapters fall relative to his
// measured split banners (115.2 / 212.5 / 312.8 / 481.4 / 653.4 video s).
const S = (id, name, status, o) => ({ id, name, status, how: [], clips: [], ...o });
export const ROUTE = [
  { summary: 'Start to the first extraction point. Every 1.0.1 runner skips the soulscourge, the black dragon and the whole necromancer area here; the records differ mostly in how strong the necro-land zoop is.',
    skips: [
      S('s-airvent', 'Windstep to the first air anima', 'works', { text: 'Grab the air charge early; zyneater notes a more direct line to the first air vent than the one shown.', clips: [C(SAMF_RUN, 18, 40, 'In the run (SamFPlays)'), C(SAMF_GUIDE, 133, 151, 'Explained')], credit: 'SamFPlays, zyneater' }),
      S('s-soul', 'Soulscourge skip (phase dash + food trick)', 'works', { clips: [C(SAMF_RUN, 40, 77, 'In the run'), C(SAMF_GUIDE, 151, 190, 'Explained')], credit: 'SamFPlays' }),
      S('s-bd1', 'Black dragon skip', 'works', { clips: [C(SAMF_RUN, 77, 95, 'In the run'), C(SAMF_GUIDE, 190, 208, 'Explained')], credit: 'SamFPlays' }),
      S('s-necro', 'Skip the necromancer area (zoop to necro land)', 'works', { how: ['Zoop across to necro land.', 'Zoop off the rocks left of the bridge toward the top of the left pillar — needs height; one or both dashes depending on the zoop.', 'Respawn (the zoop causes it) and continue.'], clips: [C(SAMF_RUN, 95, 115.2, 'In the run'), C(SAMF_GUIDE, 208, 260, 'Explained'), C(ZYN, 396, 431, 'zyneater 0→1 skip')], credit: 'Nanobit run notes, SamFPlays' }),
      S('s-vines-old', 'Dragontail Vines skip (1.0.0.6)', 'check', { text: "CrossRSDW's pre-1.0.1 Vines skip. Check it still holds before routing it.", clips: [C(CROSS, 48, 103, 'CrossRSDW')], credit: 'CrossRSDW' }),
    ] },
  { summary: 'Poison area and the Abyssal Demon. Nanobit credits SectorTSWG (via Sir_Rebral) for a new skip into Fragments.',
    skips: [
      S('s-poison', 'Skip the entire poison area', 'works', { clips: [C(SAMF_RUN, 160, 184, 'In the run'), C(SAMF_GUIDE, 260, 300, 'Explained'), C(ZYN, 431, 542, 'zyneater 1→2 skip')], credit: 'SamFPlays' }),
      S('s-demon', 'Surge + Phase Dash past the Abyssal Demon', 'works', { how: ['Surge, then Phase Dash in the air past the demon.'], clips: [C(SAMF_RUN, 184, 212.5, 'In the run'), C(SAMF_GUIDE, 300, 337, 'Explained')], credit: 'SamFPlays' }),
    ] },
  { summary: 'The Shattered Stronghold — "the hardest part of the raid". The 1.0.1 route kills the air Garou Thane through the gate and windjumps to the air door.',
    skips: [
      S('s-thane', 'Garou Thane / air door skip', 'works', { how: ['Pass the water door into the stronghold.', 'Kill the air-anima Garou Thane through the closed gate with a melee weapon.', 'Air-charged, windjump from the tip of the rubble pile up to the air door and go through.', 'Exit through the hole in the wall above the orb dispenser.', 'The Thane takes ~15 min to respawn — sleep through a night between attempts.'], clips: [C(SAMF_RUN, 220, 312.8, 'In the run'), C(SAMF_GUIDE, 337, 447, 'Explained'), C(ZYN, 542, 685, 'zyneater 2→3 skip')], credit: 'Sir_Rebral; Nanobit run notes' }),
    ] },
  { summary: 'Parkour into Cataclysm Keep and the elemental puzzle. The old full puzzle skip closed in 1.0.1; IINo1goodII and notmusty1 found a hole in the Keep.',
    skips: [
      S('s-parkour', 'Parkour section', 'works', { clips: [C(SAMF_RUN, 320, 360, 'In the run')], credit: 'SamFPlays' }),
      S('s-keep', 'Keep hole / elemental puzzle skip', 'new', { text: 'Nanobit\'s 7:01 uses it ("a lovely hole in Keep"). If it fails, do the puzzle as fast as possible.', clips: [C(SAMF_GUIDE, 447, 558, 'Explained (SamFPlays)'), C(ZYN, 685, 869, 'zyneater 3→4'), C(SAMF_RUN, 360, 481.4, 'Puzzle done normally (run)')], credit: 'IINo1goodII, notmusty1' }),
    ] },
  { summary: "Kuldra's Sanctum to the cut to black. The biggest untested save: Dotxy's 1.0.1.2 flight was posted after both record runs.",
    skips: [
      S('s-kuldra', 'Skip the Kuldra fight', 'check', { text: 'Official 1.0.1.2 notes: "Additional fixes for Kuldra Skips." FastTipsGaming showed a fight skip working on 27 Oct, after that patch. Test it before you route it.', clips: [C(SAMF_RUN, 505, 564, 'In the run'), C(SAMF_GUIDE, 558, 637, 'Explained'), C('L-dTDXJyFq0', 0, 330, 'Post-patch skip (FastTipsGaming)')], credit: 'SamFPlays; Zilko (original)' }),
      S('s-flight', 'Fly through the Sanctum (1.0.1.2)', 'new', { how: ['Windstep.', 'Jump attack → Q → targeted AoE → Esc → Jump.', 'Repeat. Windstepping up the blocks no longer works on 1.0.1.2 — flying does.'], clips: [C('GeWbo4GpFEg', 0, 90.5, 'Dotxy')], credit: 'Dotxy' }),
      S('s-heart', 'Heart: where to stand (no heartworms)', 'works', { clips: [C(SAMF_RUN, 564, 653.4, 'In the run'), C(SAMF_GUIDE, 637, 758, 'Explained')], credit: 'SamFPlays' }),
    ] },
];

export const OPPORTUNITIES = [
  { title: 'Sanctum is where the record is', kind: 'good', text: "Both record Sanctum segments (TexasPete ≈120 s, Nanobit ≈116 s) predate Dotxy's 1.0.1.2 flight through the Sanctum. No posted run uses it.", src: ['dotxyflight', 'dotxyjump'], go: ['#/route?split=4', 'Route'] },
  { title: 'Combine the best of both records', text: 'TexasPete is fastest early, Nanobit in the Keep and Sanctum. The fastest segment from each record adds up well under 6:50 — watch the composite reel.', src: ['tp650', 'nano701'], go: ['#/studio?id=p-sob', 'Watch composite'] },
  { title: "Nanobit's own sum of best is 6:51", text: '"Clearly can be done sub 7… needs very clean movement and strong zoops. Especially the 3rd black dragon area after zooping from Keep."', src: ['nano701'] },
  { title: 'The 6:50 used strats that are now patched', kind: 'info', text: "Per Nanobit. The board does not split 1.0.1 off, so the bar on today's patch is still 6:50 — new movement tech is how you get there.", src: ['nano701', 'tp650'] },
  { title: 'Reset the Air Thane', text: 'Nanobit (1.0.1 day one): the air Garou Thane took ~15 minutes to respawn, so sleep through a night between attempts. The official 1.0.1 notes say enemies now respawn on reset, so check whether this still applies.', src: ['nano832'] },
  { title: 'Ask the mods before using a macro', kind: 'info', text: 'Dotxy suggests a macro for the flight loop. The speedrun.com raid rules do not mention macros — confirm before submitting.', src: ['dotxyflight'] },
];

// Flattened drill list for Practice.
export function DRILLS() {
  const out = [];
  ROUTE.forEach((sp, k) => sp.skips.forEach(s => out.push({ ...s, split: k })));
  TECH.forEach(t => out.push({ ...t, split: null }));
  return out;
}

export const TECH = [
  { id: 'tech-dive', name: 'Dive / jump-attack cancel', status: 'works', credit: 'Dotxy', how: ['Jump attack (off Windstep or a double jump).', 'During the animation cast any targeted AoE spell.', 'Cancel the cast — you have full movement instantly.'], clips: [C('LGCddmk_TnM', 0, 51, 'Dive cancel (Dotxy)')] },
  { id: 'tech-infjump', name: 'Infinite double jump', status: 'works', credit: 'Dotxy', how: ['Windstep.', 'Jump attack → Q (spell ring) → targeted AoE → Esc → Jump.', 'Repeat from Jump attack. Faster inputs gain height instead of hovering.'], clips: [C('goKfbT19nkk', 0, 45, 'Infinite double jump (Dotxy)'), C('U0_KPXu28qw', 0, 241, 'Infinite jump tutorial (FastTipsGaming)')] },
  { id: 'tech-surge', name: 'Phase Dash + Surge combo', status: 'works', credit: 'SamFPlays', how: ['Surge first (longer, further dodges).', 'Chain Phase Dash in the air for the extra distance.'], clips: [C(SAMF_GUIDE, 0, 103, 'Phase Dash & Surge combo (SamFPlays)')] },
];

// Everything the raid route needs, in the order the Hardcore 1→Max route picks it up.
// phase = js/data/hardcore.js phase id where it is acquired. Values are from the
// route text and wiki pages cited there; `used` lists the skips that need it.
export const REQUIREMENTS = [
  { id: 'req-windstep', kind: 'spell', name: 'Windstep', need: 'Runecrafting 8 · 5 Air runes', phase: 'p0', used: ['s-airvent', 's-thane', 's-flight', 'tech-infjump'], wiki: 'windstep' },
  { id: 'req-djump', kind: 'skill', name: 'Double Jump', need: 'Agility 10', phase: 'p0', used: ['tech-infjump', 's-necro'], wiki: 'double-jump' },
  { id: 'req-tempest', kind: 'spell', name: 'Tempest Shield', need: 'Attack 11 · 15 Air runes', phase: 'p2', used: [], wiki: 'tempest-shield', note: 'Panic button; blocks all damage while held.' },
  { id: 'req-surge', kind: 'spell', name: 'Surge', need: 'Magic 11 · 10 Astral + 10 Law · Runecrafting 13 / 16 for the runes', phase: 'p2', used: ['s-demon', 'tech-surge'], wiki: 'surge' },
  { id: 'req-airdash', kind: 'skill', name: 'Air Dash', need: 'Agility 32', phase: 'p2', used: ['s-necro', 's-soul'], wiki: 'air-dash' },
  { id: 'req-phasedash', kind: 'skill', name: 'Phase Dash', need: 'Agility 44', phase: 'p3', used: ['s-soul', 's-demon', 'tech-surge'], wiki: 'phase-dash' },
  { id: 'req-recall', kind: 'spell', name: 'Recall', need: 'Agility 57 · 30 Air + 15 Law', phase: 'p4', used: [], wiki: 'recall', note: 'Practice safety net for vertical skips.' },
  { id: 'req-rrecall', kind: 'skill', name: 'Reactive Recall', need: 'Agility 70', phase: 'p5', used: [], wiki: 'recall', note: 'Fatal falls stop being run-enders.' },
  { id: 'req-enfeeble', kind: 'spell', name: 'Enfeeble', need: 'Magic 61', phase: 'p5', used: ['s-heart'], wiki: 'enfeeble' },
  { id: 'req-aoe', kind: 'spell', name: 'Any targeted AoE spell', need: 'on the spell ring (Q)', phase: 'p2', used: ['tech-dive', 'tech-infjump', 's-flight'], wiki: 'jump-attack', note: 'Powers the dive / jump-attack cancel.' },
  { id: 'req-quest', kind: 'quest', name: "Icthlarin's Little Helper → Regicide started", need: 'gates the raid entrance (NW Fractured Plains)', phase: 'p6', used: [], wiki: 'scorned-wilderness' },
  { id: 'req-fleet', kind: 'item', name: 'Fleet Foot Infusion', need: 'must bring — halves sprint stamina cost', phase: 'p6', used: ['*'], wiki: 'fleet-foot-infusion' },
  { id: 'req-tea', kind: 'item', name: 'Strong Tea', need: '+20 Rest', phase: 'p6', used: [], wiki: 'rest' },
  { id: 'req-mace', kind: 'item', name: 'Best mace (melee)', need: 'kills the air Garou Thane through the gate', phase: 'p6', used: ['s-thane'], wiki: 'garou-thane' },
  { id: 'req-staff', kind: 'item', name: '2H mage staff', need: "burns Kuldra's Heart", phase: 'p6', used: ['s-heart'], wiki: 'kuldra' },
  { id: 'req-armour', kind: 'item', name: 'Best mage armour', need: 'heart phase DPS', phase: 'p6', used: ['s-heart'], wiki: 'kuldra' },
];
