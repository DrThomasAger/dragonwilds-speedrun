# Gaps that need in-game measurement

No public source checked on 3 Nov 2026 states the values below. The `unknown` field on each entry in `data/kb/bestiary.json` lists the same gaps, per monster.

## Highest value for the raid route (1.0.1.2)

1. **Air Garou Thane respawn on repeat runs.**
   - Nanobit reported about 15 minutes on 1.0.1 day one.
   - The official 1.0.1 notes say "Obstacles and Enemies now respawn ... on reset/next run-through".
   - Measure it: kill the Thane, finish or reset the run, then time when the Thane is back, both with and without sleeping. Repeat on 1.0.1.2.
2. **Which pre-1.0.1.2 skips still work on 1.0.1.2.** These have no dated proof after 1.0.1.2:
   - fragments-skip (SectorTSWG)
   - necro-land zoop and respawn
   - abyssal-demon-skip (notmusty1)
   - air-thane-through-gate
   - rib-clip
   - Kuldra phase-3 gate skip
   - soulscourge food trick

   One comment from around 28 Oct says the keep-hole still works but has added rocks. Record one clean attempt of each and note the date.
3. **Zoop strength against framerate.** A runner thinks a lower framerate gives a stronger zoop. Nobody has tested it. Test the same zoop at 30, 60 and 144+ fps.
4. **Kuldra's Heart.**
   - Its health is not published.
   - The length of the "Get out now!" timer is unknown. Sources disagree on whether you have to reach the mouth: Game Advisor says 15 s.
   - Time from the last hit to the cut to black.
   - DPS needed with a 2H staff, comparing air magic with other spells.
5. **Heartworm spawn spots and the no-aggro standing spot.**
   - The respawn interval is not quantified.
   - Map exactly where you can stand while the boss bar stays hidden. CrossRSDW describes it as in front of the vine, behind the left rib cage.
6. **Abyssal Demon (power level 9) teleport leash.** Find the distance at which it teleports to you, and whether the Surge plus Phase Dash start spot is consistent.
7. **Black dragon line-breath and aggro.** Measure the aggro radius at each of the three spawns and the stagger-lock duration. The wiki gives a 12-minute respawn; check it.
8. **Infinite double jump.**
   - Height gained per cycle and the minimum input timing.
   - Stamina cost per cycle.
   - Whether a macro is allowed. Dotxy says macros are fine "for single player", but the speedrun.com rules are silent.
9. **Soulscourge (Kuldra's Vines blast).**
   - Damage per tick outside the dome.
   - Whether it applies the Soulscourge status.
   - How much food the food trick needs.
10. **Unannounced builds.** Confirm 1.0.1.1 and 1.0.1.3 in-game: check the version string on the main menu. CrossRSDW also mentions a "1.0.0.7".

## Missing for nearly every monster

No source gives any of these for any monster:
- attack speed
- movement speed
- aggro range, except for qualitative notes
- per-attack damage

Health and power level come from wiki infoboxes, but these raid versions have no health value:
- Kuldra's Heart
- the anima-infused (elemental) skeletons
- the Soulscourge blast

Raid-version XP is missing for most raid mobs.

## Unidentified raid enemies

- SuperStooob's "tier nine garu fiend" in the Stronghold.
- A Garou at the Keep entrance that the captions only call "Garu thing".
- Garou Exile and Garou Lightning Berserker were named in the task, but no source places them in the raid. The wiki lists them in the Fractured Plains and the Stormtouched Highlands.

## Sources that could not be read

These videos have no YouTube captions, and the local Whisper fallback failed because the machine ran out of memory. Only their titles, descriptions, chapters and comments were used:
- SamFPlays: iu2SL4oyZFQ, bStgF4YN6kU
- zyneater: 1Q21XYSKJgo, 1NfTq_kvj7k
- beandon: UK2-GwCGhHc
- 9AQrOYX103E, hs-v7QO7vao, osOFSNxnMzE, sG-Fu_CvvtY
- Nanobit's runs: doVQ9Ph256g, KljLK0Z-9jY
- the Dotxy tech clips
- ShadowStalkerTM's safespot guide (CvtvJyraTg0) and region-skip guide

Several other videos hit YouTube rate limits (HTTP 429).

Not readable at all:
- the RSDW Speedrunning Discord, which needs a login
- Reddit, which returned 403
