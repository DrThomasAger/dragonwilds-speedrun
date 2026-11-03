# Console 1.0.1.2 route (FastTipsGaming)

- **Build id:** `b-1012-console-flight`
- **For:** PlayStation/Xbox players; confirmed working on the current patch (2 Nov 2026), not a speed-optimised run.
- **Patch:** 1.0.1.2
- **Status:** works (FastTipsGaming full unedited raid + boss skip, 2026-11-02; boss skip 2026-10-27)
- **Expected time:** video length 11:39 — not a timed run

_Generated from `data/kb/builds.json`. **CHECK** marks values that conflict, are untested or inferred. Nothing here was measured in-game._

## Stats and unlocks
| Skill | Level | Unlock | Why | Source |
|---|---|---|---|---|
| Agility (**CHECK**) | 5 | Windstep | every skip; windjumps, flight start | [dragonwilds.runescape.wiki/w/Windstep](https://dragonwilds.runescape.wiki/w/Windstep) — "Windstep is a spell that is unlocked at level 5 Agility" *(Infobox on the same page says level 8; Agility unlock table and 0.12.1 history say 5. Check in-game.)* |
| Agility | 10 | Double Jump | surge-dash combo and the flight loop | [dragonwilds.runescape.wiki/w/Double_Jump](https://dragonwilds.runescape.wiki/w/Double_Jump) — "Double Jump is a perk unlocked at level 10 Agility" |
| Agility | 32 | Air Dash | "Can do 4 air dash instead of 3 towards 1st air anima pillar" | [dragonwilds.runescape.wiki/w/Air_Dash](https://dragonwilds.runescape.wiki/w/Air_Dash) — "Air Dash is a special action unlocked at level 32 Agility. While airborne, press the evade button"<br>[www.youtube.com/watch?v=doVQ9Ph256g&lc=Ugw-qVlp7mb4L170w1x4A](https://www.youtube.com/watch?v=doVQ9Ph256g&lc=Ugw-qVlp7mb4L170w1x4AaABAg) @0:51 — "0:51 Can do 4 air dash instead of 3 towards 1st air anima pillar" |
| Agility | 44 | Phase Dash | extra air dashes after weak zoops; Surge + Phase Dash combo | [dragonwilds.runescape.wiki/w/Phase_Dash](https://dragonwilds.runescape.wiki/w/Phase_Dash) — "level = 44 / cooldown = 45s / runes = Air=20, Astral=10"<br>[www.youtube.com/watch?v=ESrrkdxD1fo&t=58s](https://www.youtube.com/watch?v=ESrrkdxD1fo&t=58s) @0:58 — "Walk forward. You're going to whatever your evade button is in the bottom right mine is alt, click that like whatever your dash button is to activate surge. ..." |
| Magic | 11 | Surge | Surge + Phase Dash combo; demon skip; bridge | [dragonwilds.runescape.wiki/w/Surge](https://dragonwilds.runescape.wiki/w/Surge) — "level = 11 / cooldown = 45s / runes = Law=10/Astral=10"<br>[www.youtube.com/watch?v=ESrrkdxD1fo&t=58s](https://www.youtube.com/watch?v=ESrrkdxD1fo&t=58s) @0:58 — "Walk forward. You're going to whatever your evade button is in the bottom right mine is alt, click that like whatever your dash button is to activate surge. ..." |
| Attack | 25 | Death From Above! (jump attack) | plunge-cancel and flight both start from a jump attack | [dragonwilds.runescape.wiki/w/Death_From_Above!](https://dragonwilds.runescape.wiki/w/Death_From_Above!) — "Death From Above! is a skill perk unlocked at level 25 Attack."<br>[www.youtube.com/watch?v=LGCddmk_TnM](https://www.youtube.com/watch?v=LGCddmk_TnM) — "instantly exit the jump attack animation and ending lag by casting a targeted AOE spell, cancel the cast to gain full movement over your character instantly" |
| Artisan | 56 | Magical Mending (targeted AoE for the cancel) | the community default cancel spell; any targeted AoE works (Superheat, Artisan 20, is a lower option — see spells) | [dragonwilds.runescape.wiki/w/Magical_Mending](https://dragonwilds.runescape.wiki/w/Magical_Mending) — "skill = Artisan / level = 56 / cooldown = 60s / runes = Earth=20/Nature=10"<br>[www.youtube.com/watch?v=U0_KPXu28qw&t=17s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=17s) @0:17 — "The second spell is pretty much any AoE spell. Everyone pretty much agrees that magical mending is the best one to use because most people unlock it earlier ..." |
| Runecrafting | 1 | Air runes | Windstep (5), Phase Dash (20) | [dragonwilds.runescape.wiki/w/Runecrafting](https://dragonwilds.runescape.wiki/w/Runecrafting) — "1 Air Rune ... 3 Astral Rune ... 11 Water Rune ... 15 Earth Rune ... 25 Fire Rune ... 38 Nature Rune ... 50 Law Rune (Recipe unlocks)" |
| Runecrafting | 3 | Astral runes | Surge (10), Phase Dash (10) | [dragonwilds.runescape.wiki/w/Runecrafting](https://dragonwilds.runescape.wiki/w/Runecrafting) — "1 Air Rune ... 3 Astral Rune ... 11 Water Rune ... 15 Earth Rune ... 25 Fire Rune ... 38 Nature Rune ... 50 Law Rune (Recipe unlocks)" |
| Runecrafting (**CHECK**) | 50 | Law runes | Surge (10). The repo's hardcore.js says Runecrafting 16 for Law — the wiki says 50. Law runes also drop from Garou Packs. | [dragonwilds.runescape.wiki/w/Law_Rune](https://dragonwilds.runescape.wiki/w/Law_Rune) — "Law runes can be crafted at a rune altar at level 50 Runecrafting or higher."<br>[dragonwilds.runescape.wiki/w/Garou_Pack](https://dragonwilds.runescape.wiki/w/Garou_Pack) — "Law Rune / quantity=5-10 / rarity=10/100"<br>`repo:js/data/hardcore.js (p2)` — "Runecrafting 13 for Astral and 16 for Law runes gate this." |
| Runecrafting | 15 | Earth runes | Magical Mending (20 Earth) | [dragonwilds.runescape.wiki/w/Runecrafting](https://dragonwilds.runescape.wiki/w/Runecrafting) — "1 Air Rune ... 3 Astral Rune ... 11 Water Rune ... 15 Earth Rune ... 25 Fire Rune ... 38 Nature Rune ... 50 Law Rune (Recipe unlocks)" |
| Runecrafting | 38 | Nature runes | Magical Mending (10 Nature) | [dragonwilds.runescape.wiki/w/Runecrafting](https://dragonwilds.runescape.wiki/w/Runecrafting) — "1 Air Rune ... 3 Astral Rune ... 11 Water Rune ... 15 Earth Rune ... 25 Fire Rune ... 38 Nature Rune ... 50 Law Rune (Recipe unlocks)" |

## Items
| Slot/type | Item | Qty | Why | Source |
|---|---|---|---|---|
| weapon (melee) | Any melee weapon | 1 | "The only thing you need is access to a melee weapon, two spells, and enough runes to cast them." | [www.youtube.com/watch?v=U0_KPXu28qw&t=6s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=6s) @0:06 — "The only thing you need is access to a melee weapon, two spells, and enough runes to cast them."<br>[dragonwilds.runescape.wiki/w/Death_From_Above!](https://dragonwilds.runescape.wiki/w/Death_From_Above!) — "To perform this attack, players must be wielding a melee weapon and jump from a platform right before clicking their regular attack button. During this seque..." |
| weapon (magic) | Fire magic weapon | 1 | FastTipsGaming kills the heart with fire magic from range | [www.youtube.com/watch?v=L-dTDXJyFq0&t=69s](https://www.youtube.com/watch?v=L-dTDXJyFq0&t=69s) @1:09 — "While inside, my preferred method has always been fire magic. Simply stand back and blast spells until Coldra finally dies" |
| consumable (**CHECK**) | Fleet-Footed Infusion | not stated | not mentioned by FastTipsGaming; SamFPlays calls it a must | [www.youtube.com/watch?v=ESrrkdxD1fo](https://www.youtube.com/watch?v=ESrrkdxD1fo) — "GEAR & SETUP - Fleet Foot Infusion: MUST BRING. Cuts sprinting stamina cost by 50%. - Strong Tea: nice to have, restores +20 Rest. - Melee weapon: Best mace ..." |
| runes (**CHECK**) | Air (Windstep) + Earth/Nature (Magical Mending) | not stated |  | [dragonwilds.runescape.wiki/w/Windstep](https://dragonwilds.runescape.wiki/w/Windstep) — "cooldown = 3s / runes = Air=5"<br>[dragonwilds.runescape.wiki/w/Magical_Mending](https://dragonwilds.runescape.wiki/w/Magical_Mending) — "skill = Artisan / level = 56 / cooldown = 60s / runes = Earth=20/Nature=10" |

## Spells and spell-ring loadout
| Spell | Unlock | Runes | Ring slot | Why | Source |
|---|---|---|---|---|---|
| Windstep | Agility 5/8 | 5 Air | quick spell dial, Triangle + L1 (FastTipsGaming) | flight start | [www.youtube.com/watch?v=U0_KPXu28qw&t=66s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=66s) @1:06 — "clear some room in one of your spell radials and place only two spells, wind step and magic mending."<br>[www.youtube.com/watch?v=U0_KPXu28qw&t=95s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=95s) @1:35 — "press triangle then L1. This simply gives you wind step. Then press X to jump ... at the height of your jump, press R1 to do a slam attack. ... press triangl..." |
| Magical Mending | Artisan 56 | 20 Earth + 10 Nature | quick spell dial, Triangle + L2 (FastTipsGaming) | the cancel spell | [www.youtube.com/watch?v=U0_KPXu28qw&t=66s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=66s) @1:06 — "clear some room in one of your spell radials and place only two spells, wind step and magic mending."<br>[www.youtube.com/watch?v=U0_KPXu28qw&t=95s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=95s) @1:35 — "press triangle then L1. This simply gives you wind step. Then press X to jump ... at the height of your jump, press R1 to do a slam attack. ... press triangl..."<br>[dragonwilds.runescape.wiki/w/Magical_Mending](https://dragonwilds.runescape.wiki/w/Magical_Mending) — "skill = Artisan / level = 56 / cooldown = 60s / runes = Earth=20/Nature=10" |

## Quests and unlocks
| Quest | State | Why | Source |
|---|---|---|---|
| Icthlarin's Little Helper | complete | required to start Regicide | [dragonwilds.runescape.wiki/w/Regicide](https://dragonwilds.runescape.wiki/w/Regicide) — "start = Interact with the Dragon Gate north of the Fractured Plains. / req = Icthlarin's Little Helper"<br>[dragonwilds.runescape.wiki/w/Icthlarin's_Little_Helper](https://dragonwilds.runescape.wiki/w/Icthlarin's_Little_Helper) — "Defeat him and obtain his head. ... Congratulations! Quest Complete!" *(Final step is defeating Fuzan in the Umbral Sands.)* |
| Regicide | started (Dragon Gate north-west of the Fractured Plains) | gates entry to the Scorned Wilderness | [dragonwilds.runescape.wiki/w/Regicide](https://dragonwilds.runescape.wiki/w/Regicide) — "start = Interact with the Dragon Gate north of the Fractured Plains. / req = Icthlarin's Little Helper" |
| One prior raid clear (optional) | needed only for the Dragon Scimitar | the Dragon Scimitar comes from the Queenslayer's Reward Pack after a clear | [dragonwilds.runescape.wiki/w/Dragon_Scimitar](https://dragonwilds.runescape.wiki/w/Dragon_Scimitar) — "can be received after completing the Scorned Wilderness raid and opening the Queenslayer's Reward Pack" |

## Keybinds and controls
| Action | Key | Why | Source |
|---|---|---|---|
| PS (FastTipsGaming): Windstep | Triangle then L1 (his quick spell dial), X to jump | console flight setup | [www.youtube.com/watch?v=U0_KPXu28qw&t=95s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=95s) @1:35 — "press triangle then L1. This simply gives you wind step. Then press X to jump ... at the height of your jump, press R1 to do a slam attack. ... press triangl..." |
| PS (FastTipsGaming): cancel loop | R1 slam at jump peak → Triangle → L2 (Magical Mending) → L2 again (cancel) → X (jump) | console flight loop | [www.youtube.com/watch?v=U0_KPXu28qw&t=95s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=95s) @1:35 — "press triangle then L1. This simply gives you wind step. Then press X to jump ... at the height of your jump, press R1 to do a slam attack. ... press triangl..." |
| PS5 (comment): ring layout | Windstep on Triangle+R1; repair spell on Triangle+R2 (or L2 for left-handed) | alternative console layout | [www.youtube.com/watch?v=GeWbo4GpFEg](https://www.youtube.com/watch?v=GeWbo4GpFEg) — "Set your spell wheel to where wind step is Triangle R1 input. Set your repair equipment spell to Traingle R2 for Righties or L2 for lefties. ... Repair Spell..." *(YouTube comment by @brendonboyd7668 (PS5).)* |
| Spell ring (wheel) | Q (default) | every spell cast in the route goes through the wheel | [dragonwilds.runescape.wiki/w/Magic](https://dragonwilds.runescape.wiki/w/Magic) — "Players can access their customised spellbooks by pressing the Q-button (default), which will open the wheel whilst still seeing the player's surroundings. P..." |

## Settings and timing rules
| Setting | Value | Why | Source |
|---|---|---|---|
| HUD | keep health, inventory and stamina visible | speedrun.com rule: dynamic HUD elements must not be obscured | [www.speedrun.com/Runescape_Dragonwilds](https://www.speedrun.com/Runescape_Dragonwilds) — "All submissions requires a full video of the run, including game audio. ... Dynamic HUD elements should not be obscured or omitted (e.g. health, inventory, s..." |
| Recording | full video with audible game audio; start recording a few seconds before entering | ChiefWes's first 9:37 was rejected for missing audio | [www.speedrun.com/Runescape_Dragonwilds](https://www.speedrun.com/Runescape_Dragonwilds) — "All submissions requires a full video of the run, including game audio. ... Dynamic HUD elements should not be obscured or omitted (e.g. health, inventory, s..."<br>[www.speedrun.com/Runescape_Dragonwilds/runs/z146l1wz](https://www.speedrun.com/Runescape_Dragonwilds/runs/z146l1wz) — "Great run but audio is required. If you can next time as well make sure to start the recording a couple seconds sooner right before you go into the raid." |
| Timer start | first frame the loading icon disappears going into the raid | speedrun.com Raid timing | [www.speedrun.com/Runescape_Dragonwilds](https://www.speedrun.com/Runescape_Dragonwilds) — "Timer starts the first frame the loading icon disappears going into the raid. Timer ends on the frame the screen goes black after the "Get out now!" timer en..." |
| Timer end | frame the screen goes black after the "Get out now!" timer, after Kuldra's Heart dies | the escape run is part of the time | [www.speedrun.com/Runescape_Dragonwilds](https://www.speedrun.com/Runescape_Dragonwilds) — "Timer starts the first frame the loading icon disappears going into the raid. Timer ends on the frame the screen goes black after the "Get out now!" timer en..." |
| Bracket | 1.0.0.6+ (only version split) | a 1.0.1.2 run is compared directly with the 6:50.000 | [www.speedrun.com/api/v1/games/2689lo91/variables](https://www.speedrun.com/api/v1/games/2689lo91/variables) — "Version Range: "1.0.0.6+" / "Pre 1.0.0.6"" *(No 1.0.1.x split: a 1.0.1.2 run is ranked directly against the 6:50.)* |

## Pre-run state and practice
| Item | Detail | Source |
|---|---|---|
| Bed at Rasthin's Rest | Claim a bed in the raid hub so deaths respawn there. Needs a roof and three walls. | [www.youtube.com/watch?v=ESrrkdxD1fo&t=103s](https://www.youtube.com/watch?v=ESrrkdxD1fo&t=103s) @1:43 — "put a bed right here. Look at that janky roof, put a bed there. That way when you die you respawn right here. Uh make sure you have the strongest mace, you'r..."<br>[dragonwilds.runescape.wiki/w/Bed](https://dragonwilds.runescape.wiki/w/Bed) — "The bed requires 8 ash planks and 4 rough cloth to craft, and must be under a roof and enclosed with three walls to be used."<br>[dragonwilds.runescape.wiki/w/Death](https://dragonwilds.runescape.wiki/w/Death) — "After dying, players in both normal and hard difficulty worlds will either spawn back at their claimed bed or the lodestone inside Wise Old Man's temple if n..." |
| Full rest before entering | You cannot rest inside the raid; sleep the night before a run (Fresh Start covers ~180 s). | [dragonwilds.runescape.wiki/w/Rest](https://dragonwilds.runescape.wiki/w/Rest) — ""Resting cannot be performed during combat or a raid"" *(Quoted via js/data/wiki.js entry "rest".)*<br>[dragonwilds.runescape.wiki/w/Rest](https://dragonwilds.runescape.wiki/w/Rest) — "Fresh Start: 180 s buff after a full night: rest, hydration and sustenance stop dwindling" *(Paraphrase recorded in js/data/wiki.js entry "rest".)*<br>[www.speedrun.com/Runescape_Dragonwilds/runs/z146x3jz](https://www.speedrun.com/Runescape_Dragonwilds/runs/z146x3jz) — "I realized that Kuldra's fight was going to be a major pain in the butt if I didnt go rest midway and sadly didn't bring any tea with me to restore rest on t..." |
| Air Garou Thane respawn (**CHECK**) | ~15 min respawn: sleep through a night after each completed run, or he will not be there next run. 1.0.1 notes say enemies respawn on reset — check whether this still applies. | [www.youtube.com/watch?v=vw_Mr5TGJAg](https://www.youtube.com/watch?v=vw_Mr5TGJAg) — "Air Thane takes like 15 minutes to respawn, it's best to just sleep through a night after completing a run... otherwise he doesn't spawn in the next run and ..."<br>[dragonwilds.runescape.wiki/w/Update:Eye_on_Ashenfall_-_1.0.1](https://dragonwilds.runescape.wiki/w/Update:Eye_on_Ashenfall_-_1.0.1_Update) — "Obstacles and Enemies now respawn in the Scorned Wildnerness Raid on reset/next run-through." |
| Fresh raid | After Kuldra dies, progress resets and Zilyana only sends you to Dragontail Vines. | [dragonwilds.runescape.wiki/w/Scorned_Wilderness/Quick_guide](https://dragonwilds.runescape.wiki/w/Scorned_Wilderness/Quick_guide) — "Once Kuldra has been slain, Commander Zilyana's ability to teleport you to locations other than Dragontail Vines will reset." |
| Repeat-run teleport bug (1.0.1.2) (**CHECK**) | On repeat runs the Commander teleport near Kuldra can drop you through the floor to your death. Check before a timed attempt. | [www.youtube.com/watch?v=JuuIF0BeGaE](https://www.youtube.com/watch?v=JuuIF0BeGaE) — "Happens every time you repeat final boss. Commander teleports you to the next platform and in doing so you spawn in middle of the ground and fall down to the..."<br>[www.youtube.com/watch?v=zl7R_N-vByw](https://www.youtube.com/watch?v=zl7R_N-vByw) — "Good job jagex you really fixed Kuldra skip !" |
| Autosave hazard | An autosave during the flight loop can drop you. | [www.youtube.com/watch?v=U0_KPXu28qw&t=57s](https://www.youtube.com/watch?v=U0_KPXu28qw&t=57s) @0:57 — "If the game auto saves while you're trying to perform this trick, you're going down." |

## Route

### 1. All splits — Full raid with the infinite-jump cycle

- Follow the unedited run.
- Sanctum: go down the middle — Jagex patched every rock FastTipsGaming tried, including the bridge.

Clips: [oK0_U_I40DY 0:00–11:39](https://www.youtube.com/watch?v=oK0_U_I40DY&t=0s), [L-dTDXJyFq0 0:00–5:30](https://www.youtube.com/watch?v=L-dTDXJyFq0&t=0s)

Sources: [www.youtube.com/watch?v=oK0_U_I40DY](https://www.youtube.com/watch?v=oK0_U_I40DY) — "In this video, I'll be showing you my full unedited Kuldra raid and boss skip in Runescape Dragonwilds."<br>[www.youtube.com/watch?v=L-dTDXJyFq0&t=29s](https://www.youtube.com/watch?v=L-dTDXJyFq0&t=29s) @0:29 — "Instead of using the leftmost platform to jump on, and because Jagex has patched every freaking single rock I've tried to jump on, including the bridge itsel..."

## Sources

-  — https://dragonwilds.runescape.wiki/w/Windstep
-  — https://dragonwilds.runescape.wiki/w/Double_Jump
-  — https://dragonwilds.runescape.wiki/w/Air_Dash
- Runescape: Dragonwilds | 7:01 Kuldra | 1.0.1/1.0.1.1 Legacy WR (description + comments) — Nanobit — https://www.youtube.com/watch?v=doVQ9Ph256g&lc=Ugw-qVlp7mb4L170w1x4AaABAg @0:51
-  — https://dragonwilds.runescape.wiki/w/Phase_Dash
- (Patched!) Sub 10 Min Kuldra Skip Guide (Post-Patch 1.0.1) – Every Skip Explained — SamFPlays — https://www.youtube.com/watch?v=ESrrkdxD1fo @0:58
-  — https://dragonwilds.runescape.wiki/w/Surge
-  — https://dragonwilds.runescape.wiki/w/Death_From_Above!
- 1.0.1 Update New Movement Tech - Dive Cancel — Dotxy — https://www.youtube.com/watch?v=LGCddmk_TnM
-  — https://dragonwilds.runescape.wiki/w/Magical_Mending
- Infinite Jump EXPLOIT 1.0 Dragonwilds — FastTipsGaming — https://www.youtube.com/watch?v=U0_KPXu28qw @0:17
-  — https://dragonwilds.runescape.wiki/w/Runecrafting
-  — https://dragonwilds.runescape.wiki/w/Law_Rune
-  — https://dragonwilds.runescape.wiki/w/Garou_Pack
-  — repo:js/data/hardcore.js (p2)
- UNPATCHED Kuldra Raid Fight SKIP — FastTipsGaming — https://www.youtube.com/watch?v=L-dTDXJyFq0 @1:09
-  — https://dragonwilds.runescape.wiki/w/Regicide
-  — https://dragonwilds.runescape.wiki/w/Icthlarin's_Little_Helper
-  — https://dragonwilds.runescape.wiki/w/Dragon_Scimitar
- speedrun.com game + Raid category rules — speedrun.com (mods Archy, dotyoureyes) — https://www.speedrun.com/Runescape_Dragonwilds
-  — https://www.speedrun.com/Runescape_Dragonwilds/runs/z146l1wz
-  — https://www.speedrun.com/api/v1/games/2689lo91/variables
- NEW Dragonwilds Kuldra Skip (1.0.1.2) - Tech & Tutorial in description — Dotxy — https://www.youtube.com/watch?v=GeWbo4GpFEg
-  — https://dragonwilds.runescape.wiki/w/Magic
-  — https://dragonwilds.runescape.wiki/w/Bed
-  — https://dragonwilds.runescape.wiki/w/Death
-  — https://dragonwilds.runescape.wiki/w/Rest
-  — https://www.speedrun.com/Runescape_Dragonwilds/runs/z146x3jz
- Runescape: Dragonwilds | 8:32 Kuldra | 1.0.1 Day 1 Strats — Nanobit — https://www.youtube.com/watch?v=vw_Mr5TGJAg
-  — https://dragonwilds.runescape.wiki/w/Update:Eye_on_Ashenfall_-_1.0.1_Update
-  — https://dragonwilds.runescape.wiki/w/Scorned_Wilderness/Quick_guide
- Kuldra Boss new bug (fixed) — Bazilleos — https://www.youtube.com/watch?v=JuuIF0BeGaE
- Good job jagex you really fixed Kuldra skip ! — Vytautas Balnis — https://www.youtube.com/watch?v=zl7R_N-vByw
-  — https://www.youtube.com/watch?v=oK0_U_I40DY

## Open questions (all builds)

- Run totals of Air/Astral/Law/Earth/Nature runes per run: no source counts casts. Count them in Nanobit 7:01 or in-game.
- Whether a cancelled targeted-AoE cast (plunge-cancel/flight) spends runes or starts the cooldown.
- What "E" does in Nanobit's "Q1E" cancel input; and which spell sits in his ring slot 1.
- Windstep unlock level: wiki text says Agility 5, its infobox says 8 (hardcore.js says Runecrafting 8, which predates 0.12.1).
- Law rune level: wiki says Runecrafting 50; hardcore.js/route.js say 16.
- Whether the Dragon Scimitar can jump attack after the 1.0.1.2 fix.
- Whether the Keep hole (elemental puzzle skip) survived 1.0.1.2.
- Whether the air Thane still needs ~15 min to respawn after 1.0.1's "enemies respawn on reset".
- Frame-rate limit effect on zoop strength (Nanobit: untested).
- Sensitivity, FOV, KBM Action Direction and Visceral Attack Camera used by top runners: no source.
- Whether speedrun.com mods allow a flight macro.
- Whether Reactive Recall triggers on falling out of the map (hardcore build).
- Nanobit's and TexasPete's armour and food: not stated anywhere read.
- zyneater 1Q21XYSKJgo has no captions; its 0-1 tips (3:59–6:36) were not transcribed.
