# Switch 2 setup: Scorned Wilderness raid (Kuldra) speedrun

- **Platform:** Nintendo Switch 2 (docked, recorded through a capture card)
- **Category:** speedrun.com Raid, Scorned Wilderness, Version Range **1.0.0.6+**
- **Target:** 6:48.1 (splits 1:22.7 / 2:23.2 / 3:15.7 / 4:42.3 / 6:48.1), from [runpath.md](../runpath.md)
- **Compiled:** 2026-11-03. **CHECK** marks anything unverified, inferred or conflicting. Nothing here was tested on a Switch 2.

## 0. Does Dragonwilds run on Switch 2? Yes.

There is a native Switch 2 version, so no streaming or other-platform workaround is needed.

| Fact | Source (quoted) |
|---|---|
| Native Switch 2 release on 15 Sep 2026, the same day as the 1.0 launch on PC/PS5/Xbox | Jagex press release, [jagex.com/news/...switchtm-2-this-septembe](https://jagex.com/news/runescape-dragonwilds-launches-on-nintendo-switchtm-2-this-septembe): "will launch on Nintendo Switch™ 2 on 15th September, 2026." Official site [dragonwilds.runescape.com/news/dragonwilds-switch-2](https://dragonwilds.runescape.com/news/dragonwilds-switch-2): "when RuneScape: Dragonwilds launches on Nintendo Switch 2 systems on September 15th!" |
| eShop listing | [nintendo.com/en-gb/.../RuneScape-Dragonwilds-3110764](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-2-games/RuneScape-Dragonwilds-3110764.html): "Release date: 15/09/2026". It lists TV, tabletop and handheld modes; Players: Single System (1), Online (1-4); "Any online play modes require a paid membership to Nintendo Switch Online"; Save Data Cloud; 34.6 GB. Publisher: Jagex. |
| Switch 2 is an accepted speedrun.com platform | SRC API [games/2689lo91?embed=platforms](https://www.speedrun.com/api/v1/games/2689lo91?embed=platforms) lists `"name":"Switch 2"` (id 3167lw9q) alongside PC, PS5, PS5 Pro and the Xbox models. |
| No console Raid runs exist yet | SRC API runs for category xd19vy4k (fetched 2026-11-03): all 15 Raid submissions are platform PC. A Switch 2 run would be the first console Raid run. |
| Original Switch | Not released there. Only the Switch 2 is listed. |

### Patch parity with PC 1.0.1.2 (**CHECK**: this is the most important item)

- PC 1.0.1.2 went live on 2026-10-23. Its notes include "Additional fixes for Kuldra Skips." and "Fixed an issue where the Dragon Scimitar would not allow users to Jump Attack in certain circumstances." ([wiki: Update 1.0.1.2](https://dragonwilds.runescape.wiki/w/Update:1.0.1.2_is_now_live!_-_Eye_on_Ashenfall), mirror of [Steam news](https://store.steampowered.com/news/app/1374490/view/701031128264349232)).
- Consoles use a different version label. MP1st: console players "will see this as RuneScape: Dragonwilds update 1.001.002" ([mp1st.com/?p=317333](https://mp1st.com/?p=317333), via search summary; the page itself could not be fetched).
- Switch 2 patches arrive later than PC. On the emergency Kuldra-platform fix (2026-10-23), MP1st reports that Jagex "cannot guarantee a timeline for when each platform gets their respective patch due to console verification timelines". It also says Switch 2 players would get it the following week, and that mismatched patches block crossplay ([mp1st.com/?p=317376](https://mp1st.com/?p=317376)).
- **What to do:** before your first attempt, read the build number on the title screen or under Settings → Updates, and compare it with the PC build.
  - **If the Switch 2 build is behind 1.0.1.2:** the patched "windstep up the blocks" Sanctum route (35 s, versus about 49-52 s for flight) might still work. Test it in practice, but plan around the flight.
  - **If the Switch 2 build includes 1.0.1.2:** use the flight, as below.
  - **Either way:** both builds rank in the same SRC bracket (1.0.0.6+).
- Performance: Jagex has acknowledged that the Switch 2 version looks and runs below its standards and has promised several optimisation updates, including a later move to Unreal Engine 5.8 ([massivelyop 2026-09-28](https://massivelyop.com/2026/09/28/runescape-dragonwilds-promises-to-address-nintendo-switch-2-versions-lackluster-visuals-and-performance/); [vandal](https://vandal.elespanol.com/noticia-amp/2026271019/los-creadores-de-runescape-dragonwilds-prometen-mejoras-en-switch-2-no-esta-al-nivel-que-deseamos/)). **CHECK:** no published fps or resolution figures for Switch 2 were found.
- Console route parity: an Xbox player commented on TexasPete's 6:50 that "everything I saw I'm able to do on console other than the last way to get the last extraction point since on console there's a wall there. But there's an alternative route." (@lordjunk5847, [6WEIHo7AUf0](https://www.youtube.com/watch?v=6WEIHo7AUf0) comments.) **CHECK:** it is unknown whether the same wall exists on the Switch 2 build.

## 1. World / server setup

| Setting | Use | Why / source |
|---|---|---|
| World type | **Play solo** | The wiki says "Play solo - Players can choose this type to open a private world." ([Worlds](https://dragonwilds.runescape.wiki/w/World)). The Raid category is solo-only: the Multiplayer category is a separate Any% board. Solo also lets you pause, per 0.8.1: "You can now pause the game whilst in Solo mode." ([Settings update history](https://dragonwilds.runescape.wiki/w/Settings)). |
| Mode | **Standard** (not Custom, not Creative) | Custom Mode exposes Spell Cost Scale 0.0x, Spell Cooldown Scale 0.0x, Player Stamina Scale up to 3.0x and Invulnerable ([Custom Mode](https://dragonwilds.runescape.wiki/w/Custom_Mode)). The SRC Raid rules say nothing about world mode, but any of these would invalidate a run in practice. **CHECK with the mods (Archy, dotyoureyes; [Discord](https://discord.gg/aGZkuC5yK6)) before running on anything other than Standard.** |
| Difficulty | **Normal** | The Raid category has no Difficulty variable; only Any% and Multiplayer do (SRC API variables). On Hard, enemies deal "15% more damage" and survival stats can kill you ([Worlds](https://dragonwilds.runescape.wiki/w/World)). |
| Crossplay | Off, or leave it as set; it makes no difference solo | Crossplay is a host toggle that only matters for joining players (third-party guides such as [games.gg](https://games.gg/runescape-dragonwilds/guides/runescape-dragonwilds-crossplay-guide/); Jagex does not document the exact menu name). **CHECK** in-game. |
| Dedicated server | Not available on Switch 2 | Dedicated servers are a Windows and Linux tool only, so consoles cannot host one (whisperofthehouse / gameserverkings guides). |
| Nintendo Switch Online | Not required for solo play | The eShop listing says NSO is needed for "online play modes". Its **Save Data Cloud** feature is your only backup (see §6). |
| Save handling | Use one dedicated speedrun character and world | On PC, runners force-close the game after a failed zoop to reset raid progress, and they back up the character JSON first (Nanobit, [doVQ9Ph256g comment](https://www.youtube.com/watch?v=doVQ9Ph256g)). The Switch 2 equivalent is HOME → X (close software). **CHECK:** whether closing the software on Switch 2 resets raid progress the same way has not been verified. You cannot copy save files on the Switch 2, so upload to the NSO cloud before you experiment. |

## 2. Console settings

### Controller and button map

Defaults: the wiki's controller table is written for an Xbox pad and dates from the 0.9.3 controller rework ("Updated controller mapping", 11 Nov 2025, [Settings](https://dragonwilds.runescape.wiki/w/Settings)).

| Action | Xbox default (wiki) | Switch 2 equivalent (same physical position) |
|---|---|---|
| Jump | A | **B** (bottom face button) |
| Evade / Air Dash / Surge dodge | B | **A** (right face button) |
| Primary Action (attack, jump attack) | RT | **ZR** |
| Secondary Action | LT | ZL |
| Special Action | RB | R |
| Spells Menu / Spell Book | LB | **L** |
| Sprint | L-press | L-stick press |
| Crouch | R-press | R-stick press |
| Mount | Y | X |
| Interact | X | Y |

**CHECK: this conflicts with FastTipsGaming's console inputs.** On PlayStation he opens his quick spell dial with **Triangle**, picks spells with **L1/L2**, and slams with **R1** ([U0_KPXu28qw @1:32-3:17](https://www.youtube.com/watch?v=U0_KPXu28qw&t=92s)). That implies a 1.0 console layout in which the top face button opens a 4-slot quick spell dial and the shoulder buttons pick from it. The wiki table may be out of date. **Open Settings → Controls → Key bindings on the Switch 2 and write down the real defaults before you practise.** The rest of this doc uses FastTipsGaming's layout, converted to Switch positions:

| PS (FastTipsGaming) | Switch 2 position |
|---|---|
| Triangle (open quick spell dial) | **X** (top) |
| X (jump) | **B** (bottom) |
| L1 (dial slot: Windstep) | **L** |
| L2 (dial slot: Magical Mending) | **ZL** |
| R1 (slam / jump attack) | **R** |

Recommended remaps (all optional; only do them if the rebind menu allows it):
- **Sprint off the stick click.** Turn on **Press To Sprint** ([Settings](https://dragonwilds.runescape.wiki/w/Settings): "Players can press the Sprint key to toggle sprinting on and off"). Nanobit lost about 1.5 s by tapping sprint while already sprinting (0:23 note, [doVQ9Ph256g](https://www.youtube.com/watch?v=doVQ9Ph256g)). Toggle sprint also stops your thumb holding L3 during the flight loop. **CHECK** whether toggle sprint is available on console.
- Keep **Jump on B and the dial on X**. Your right thumb then rolls between X and B without leaving the face buttons, which is the core of the flight loop.
- The PS5 alternative is Windstep on Triangle+R1 and the AoE on Triangle+R2, or on L2 if you are left-handed (@brendonboyd7668, [GeWbo4GpFEg comments](https://www.youtube.com/watch?v=GeWbo4GpFEg)). On Switch 2 that is X+R and X+ZR.
- **Joy-Con 2 mouse mode: CHECK.** The eShop page does not mention mouse support, and no source says Dragonwilds supports it on Switch 2. Use a Pro Controller (Switch 2 Pro Controller recommended for its back buttons GL/GR, which you can map at system level to X or B, **CHECK**).

### Camera, aim, performance, display

| Setting | Value | Note |
|---|---|---|
| Gamepad Action Direction | **Camera Facing** (**CHECK**) | The options are Camera Facing and Character Facing ([Settings](https://dragonwilds.runescape.wiki/w/Settings)). Surge goes "eight metres away from the direction they are currently facing" ([Surge](https://dragonwilds.runescape.wiki/w/Surge)), so Camera Facing lets you aim dodges with the right stick. No runner has said which setting they use. |
| Sensitivity X / Y | Start at 5 (default) and raise X to about 6-7 | No runner source exists. Turning fast for zoops matters more than precise aim. **CHECK.** |
| Invert | Off | |
| Aim assist | **Not an option**: the wiki lists no aim-assist setting. **CHECK** the console menu. | |
| Screen Shake | Off | Gameplay setting, enabled by default ([Settings](https://dragonwilds.runescape.wiki/w/Settings)). Off makes the knockback and slam readable. |
| Visceral Attack Camera | Off (**CHECK**) | The toggle was added in 1.0.1, the same patch as the jump attack ([1.0.1 notes](https://dragonwilds.runescape.wiki/w/Update:Eye_on_Ashenfall_-_1.0.1_Update)). Off should keep the camera steady during the slam. Untested. |
| Controller Vibration | Off | Personal choice; it removes a distraction during the flight loop. |
| Frame rate / quality mode | **Performance / highest frame rate, if the Switch 2 build offers one (CHECK)** | The PC options (Frame Rate Limit, upscaler) are not documented for Switch 2. Nanobit thinks "lower framerates can give better zoops", but says he "can't/haven't really tested that" ([doVQ9Ph256g comment](https://www.youtube.com/watch?v=doVQ9Ph256g)). Pick the steadiest frame rate available, because the flight loop is timing-sensitive. |
| Docked vs handheld | **Docked** | A capture card only receives video from the dock's HDMI port. Handheld cannot be captured externally, and built-in capture is limited to 30 s (§5). |
| Input latency | Wired Pro Controller over USB (**CHECK** whether the dock accepts wired input for this game), or keep the controller near the console. Put the TV in **Game Mode**. Watch the TV, or the card's passthrough output, never the OBS preview. | Standard console practice; nothing here is specific to Dragonwilds. |
| HDR | Off | Elgato recommends disabling HDR if colours look washed out in the capture ([Elgato help](https://help.elgato.com/hc/en-us/articles/35977221307153)). |
| HUD | **Leave every HUD element on** | SRC game rules: "Dynamic HUD elements should not be obscured or omitted (e.g. health, inventory, s[tamina])" ([speedrun.com/Runescape_Dragonwilds](https://www.speedrun.com/Runescape_Dragonwilds), quoted in the repo's build docs). Do not turn on Hide Chat if it hides anything other than chat, and keep any webcam or split overlays off the health, stamina and quick bar. |

## 3. Loadout

### Stats and unlocks required (from [b-1012-record-flight.md](b-1012-record-flight.md))
Agility 5 (Windstep; the infobox says 8, **CHECK**), Agility 10 (Double Jump), Agility 32 (Air Dash), Agility 44 (Phase Dash), Magic 11 (Surge), Attack 25 (Death From Above! jump attack), Artisan 56 (Magical Mending). Quests: Icthlarin's Little Helper complete, Regicide started.

### Equipment per slot
| Slot | Item | Source / note |
|---|---|---|
| Main hand (melee) | **Best mace**: a weapon with a plunge animation; the Thane is weak to crush | SamFPlays: "Melee weapon: Best mace" ([ESrrkdxD1fo](https://www.youtube.com/watch?v=ESrrkdxD1fo) description). [Garou Thane](https://dragonwilds.runescape.wiki/w/Garou_Thane): "weakness = Crush". Death From Above! needs a melee weapon. |
| Alt melee (**CHECK**) | Dragon Scimitar | Nanobit's main weapon. 1.0.1.2 "Fixed an issue where the Dragon Scimitar would not allow users to Jump Attack in certain circumstances", so test whether it now plunge-cancels. If it does, it can replace the mace. |
| Off hand | Shield (optional) | SamFPlays @5:38: "Put on your mace, shield, and then..." |
| Magic weapon (optional) | Fire magic staff / best 2H mage staff | Use it if you are not doing the melee heart safespot. FastTipsGaming @1:09 ([L-dTDXJyFq0](https://www.youtube.com/watch?v=L-dTDXJyFq0&t=69s)): "my preferred method has always been fire magic." The melee safespot is about 45 s faster (runpath.md). |
| Body armour (**CHECK**) | Best mage armour | SamFPlays only. No record runner states their armour. |
| Legs (optional, **CHECK**) | Leggings of Lightness | "Also removes the rune cost of the spell Windstep." ([wiki](https://dragonwilds.runescape.wiki/w/Leggings_of_Lightness)) |
| Quick slots | Food (pies), consumables | Nanobit keeps his helmet and pies on quick slots 3 and 4. |

### Consumables
| Item | Qty | Use |
|---|---|---|
| **Fleet-Footed Infusion** | 2 | "reduces the stamina cost of sprinting by 50% for 300 seconds" ([wiki](https://dragonwilds.runescape.wiki/w/Fleet-footed_infusion)). Drink one just before entering. Re-drink at the Thane/air-door segment around run time 3:00-3:20, as Nanobit's 3:22 note says: "Don't forget to re-use your fleet-footed infusion here". 300 s does not cover a 6:48 run, so you need two. |
| **Strong Tea** | 1 | "10 hydration and 20 rest" ([wiki](https://dragonwilds.runescape.wiki/w/Strong_Tea)). You cannot rest inside the raid. |
| Runes | Large stacks of Air, Astral, Law, Earth and Nature | Per cast: Windstep 5 Air; Surge 10 Law + 10 Astral; Phase Dash 20 Air + 10 Astral; Magical Mending 20 Earth + 10 Nature. **CHECK:** the total per run has never been counted, and nobody has documented whether a cancelled cast spends runes. Bring several hundred of each. |

### Spells: controller dial loadout
- **Quick spell dial (opened with X on Switch, Triangle on PS):** only **Windstep** on L and **Magical Mending** on ZL. FastTipsGaming ([U0_KPXu28qw @1:06](https://www.youtube.com/watch?v=U0_KPXu28qw&t=66s)): "clear some room in one of your spell radials and place only two spells, wind step and magic mending. You'll notice I have them both on the quick spell dial. That's not by accident."
- **Second dial:** **Surge** and **Phase Dash** (on PC, loopuleasa uses ring slots 3 and 4: "I spam Q+3 and Q+4 to enable surge and dash"). Put them on the other dial page or the remaining shoulder slots (R/ZR) of the quick dial. **CHECK** how many slots the console quick dial has.
- **Cancel spell:** Magical Mending, the community default. FastTipsGaming @0:17: "Everyone pretty much agrees that magical mending is the best one to use because most people unlock it earlier". Dotxy says "any targeted aoe spell" works, and he has Superheat (Artisan 20) on his ring, which is a lower-level option.

## 4. Key inputs on a Switch 2 controller

All inputs below use the FastTipsGaming layout converted in §2. **CHECK them against your actual bindings.**

| Tech | Inputs | Source |
|---|---|---|
| Jump attack (Death From Above!) | Jump (**B**), then attack (**R**) at or above double-jump height | "jump from a platform right before clicking their regular attack button" ([wiki](https://dragonwilds.runescape.wiki/w/Death_From_Above!)). FastTipsGaming: "at the height of your jump, press R1 to do a slam attack." |
| Plunge cancel (dive cancel) | During the slam: **X** (dial) → **ZL** (Magical Mending) → **ZL** again to cancel | Dotxy ([LGCddmk_TnM](https://www.youtube.com/watch?v=LGCddmk_TnM)): "instantly exit the jump attack animation and ending lag by casting a targeted AOE spell, cancel the cast to gain full movement". FastTipsGaming @2:04-2:34: "press triangle in the very beginning of our slam attack ... Press L2 to activate the spell magical mending, which also cancels out your slam attack ... press L2 again to cancel the spell." |
| **Infinite double-jump / flight loop** | **X → L** (Windstep armed) → **B** (jump; Windstep fires) → loop: **R** (slam at the jump peak) → **X** (dial, right at the start of the slam) → **ZL** (Mending) → **ZL** (cancel) → **B** (jump) → repeat | FastTipsGaming @1:32-3:26: "press triangle then L1. This simply gives you wind step. Then press X to jump, which activates your wind step ... After jumping, you're going to press R1 to do another slam attack. Again, during the slam attack, press triangle ... Press L2 to select magical mending, then press L2 again to cancel it. Lastly, press X to jump again." PC version (Dotxy, [GeWbo4GpFEg](https://www.youtube.com/watch?v=GeWbo4GpFEg)): "1.Windstep 2. Jump Attack 3. Q (Spell Ring) 4. [any targeted aoe spell] 5. Escape (closes Spell Ring interface) 6. Jump Repeat steps 2-6". |
| Air Dash / Surge / Phase Dash during flight | Evade (**A**) in the air | "you can dash n phase dash doing this too" (@IINo1goodII, who also says "I've been doing this consistently on console", [GeWbo4GpFEg comments](https://www.youtube.com/watch?v=GeWbo4GpFEg)) |
| Practice budget | 1-2 h on the loop alone | FastTipsGaming @0:35: "This is going to take at least an entire hour of practice"; @3:33: "This took me about 2 hours". |

**Autosave hazard:** FastTipsGaming @0:57 says "If the game auto saves while you're trying to perform this trick, you're going down." No workaround is known. If you drop during the Sanctum flight, you are most likely to recover by restarting the loop from the nearest ledge.

**Macros:** the Switch 2 has no macro feature. Whether SRC allows macros is unknown anyway, so do every input by hand.

## 5. Recording (SRC requirements)

- SRC rules: "All submissions requires a full video of the run, including game audio." Raid timing: "Timer starts the first frame the loading icon disappears going into the raid. Timer ends on the frame the screen goes black after the "Get out now!" timer ends after defeating Kuldra's Heart." ([SRC](https://www.speedrun.com/Runescape_Dragonwilds); Raid rules from the SRC API, category xd19vy4k)
- ChiefWes's run was rejected for missing audio. The mod's comment: "audio is required ... make sure to start the recording a couple seconds sooner right before you go into the raid." ([z146l1wz](https://www.speedrun.com/Runescape_Dragonwilds/runs/z146l1wz))
- **Built-in Switch 2 capture cannot be used for a submission.** Holding the Capture button saves only the last 30 s, the same limit as the original Switch ([GoNintendo](https://gonintendo.com/contents/48589-switch-2-appears-to-continue-switch-s-30-second-video-capture-limit), [Notebookcheck](https://www.notebookcheck.net/Despite-improved-Nintendo-Switch-2-specs-video-captures-are-still-limited-to-30-seconds.1019105.0.html)). A run takes about 7 min. The clips are still useful for reviewing a failed flight.
- **Use a capture card on the dock's HDMI output.** Elgato: "Make sure that you are connecting your Elgato Capture device to the Switch 2 Dock via HDMI, and not to the USB-C port on the Switch 2." ([Elgato help](https://help.elgato.com/hc/en-us/articles/35977221307153-Nintendo-Switch-2-Troubleshooting-Video-and-Audio-Issues-with-Elgato-Capture-Devices); setup guide: [Game Capture 4K S + Switch 2](https://www.elgato.com/ww/en/explorer/products/capture/how-to-set-up-game-capture-4k-s-with-nintendo-switch-2/))
  - Chain: Switch 2 dock HDMI → capture card IN → card passthrough OUT → TV. Card USB → PC running OBS. Record at 1080p60 (MKV, or fragmented MP4 so a crash does not corrupt the file), then upload to YouTube unlisted or public so it embeds on SRC.
  - **Audio:** do NOT plug a headset into the Switch 2 or the controller. Elgato warns it can send the audio away from the card and leave you with a silent recording. Listen through the PC or the TV instead. Check the audio meters in OBS before every attempt.
  - Use the official dock. Third-party docks can have HDCP handshake problems ([tech-insider](https://tech-insider.org/?p=31588)). If you get no signal, power-cycle while docked, toggle the dock's 120 Hz output, or change the EDID in Elgato's utility.
- **Timing:** LiveSplit on the PC (manual splits: S1 Fragments, S2 portal, S3 forest/air door done, S4 Keep exit, END cut to black). There is no console autosplitter, so time the final result from the video (load icon gone → screen black). Show the timer in an OBS overlay that does not cover the HUD.

## 6. Pre-run checklist

1. Check the build number, and compare it with PC 1.0.1.2 (§0).
2. Use a Standard, Normal, Play-solo world (§1). Upload the save to NSO Save Data Cloud.
3. Claim a bed at **Rasthin's Rest** so deaths respawn in the hub. A bed "must be under a roof and enclosed with three walls" ([Bed](https://dragonwilds.runescape.wiki/w/Bed)). SamFPlays @1:43: "put a bed right here ... That way when you die you respawn right here."
4. Sleep through a full night before entering: you cannot rest in a raid ([Rest](https://dragonwilds.runescape.wiki/w/Rest)).
5. **Air Garou Thane respawn takes about 15 min.** Nanobit ([vw_Mr5TGJAg](https://www.youtube.com/watch?v=vw_Mr5TGJAg)): "Air Thane takes like 15 minutes to respawn, it's best to just sleep through a night after completing a run". **CHECK:** the 1.0.1 notes say "Obstacles and Enemies now respawn ... on reset/next run-through". The FastTipsGaming no-kill launch in the target route does not need the Thane; the Nanobit fallback does.
6. **Repeat-run bug:** on repeat runs the Commander teleport can drop you through the floor near Kuldra ([JuuIF0BeGaE](https://www.youtube.com/watch?v=JuuIF0BeGaE)). The fix's Switch 2 rollout lagged PC (§0). **CHECK** on your build.
7. Gear and consumables in quick slots (§3). Dial loadout set. Fleet-Footed Infusion drunk about 5 s before you enter.
8. Start the OBS recording, check the audio meter, and go in. After Kuldra dies the raid resets, and Zilyana only teleports you to Dragontail Vines ([Quick guide](https://dragonwilds.runescape.wiki/w/Scorned_Wilderness/Quick_guide)).

## 7. Route (1.0.1.2-valid run path, target 6:48.1)

Full detail is in [runpath.md](../runpath.md). Times are run time (s).

| Segment | Target | Cumulative | Strat (source clip) |
|---|---|---|---|
| Start → air anima pillar | 21.0 | 0:21.0 | Sprint from frame 1, 4 air dashes (TexasPete 6:50 `6WEIHo7AUf0` 7-28) |
| → soulscourge passed | 39.3 | 1:00.3 | Windstep from the anima, through the room without fighting, 3 air dashes (Nanobit `doVQ9Ph256g` 46-85) |
| → black dragon passed | 10.4 | 1:10.7 | Earth pillar about 1 s early, i-frame Kuldra's knockback (TexasPete 7:40 `6N3NwYA5Zh0` 100-110) |
| **S1 Fragments** | 12.0 | **1:22.7** | TexasPete direct line (**CHECK**, unverified on 1.0.1.2). Fallback: Nanobit vines zoop, about 2 s slower |
| → fortress courtyard | 22.3 | 1:45.0 | Zoop from the keep wall across the pond to the gate |
| → abyssal demon passed | 30.0 | 2:15.0 | Poison-area hole + Surge/Phase Dash past the demon |
| **S2 portal** | 8.2 | **2:23.2** | Golden path. Surge from Nanobit's 2:45 spot |
| **S3 forest** | 52.5 | **3:15.7** | FastTipsGaming no-kill launch: rocks left of the air door → Windstep → glide over the island (`oK0_U_I40DY` 282-334, **CHECK**). Fallback: Nanobit Thane kill + air door (about 57 s). **Re-drink Fleet-Footed Infusion here.** |
| → Keep entry | 33.6 | 3:49.3 | Floating-island parkour (Nanobit) |
| **S4 Keep** → Sanctum door | 73.5 | 5:02.8 (S4 target **4:42.3**) | Keep hole into OOB + instant rib clip, plunge-cancels at 5:07/5:12 (Nanobit). **CHECK:** whether the hole survived 1.0.1.2 is unconfirmed; FastTipsGaming used it on 2026-11-02, so it most likely still works |
| → heart tunnel | 49.0 | 5:51.8 | **Sanctum flight loop** (Dotxy `GeWbo4GpFEg`), down the middle; Jagex patched every rock FastTipsGaming tried, including the bridge (`L-dTDXJyFq0` @0:29). This is the segment with the biggest swing. |
| → heart dead | 42.5 | 6:34.3 | Melee safespot (Nanobit's correct jump at 6:53 in his video) |
| **END** | 13.8 | **6:48.1** | Fixed escape after GET OUT NOW |

## 8. Open CHECK items, ranked

1. **Switch 2 build vs PC 1.0.1.2.** Read the in-game build number. This decides whether you use the Sanctum flight or the blocks, and whether the floor-fall bug fix is present.
2. **Actual console button defaults.** The wiki's Xbox table (RT attack, LB spells) conflicts with FastTipsGaming's layout (Triangle dial, L1/L2 spells, R1 slam). Write down your Settings → Key bindings before practising.
3. **World mode legality.** Use Standard/Normal/solo. Ask the SRC mods before using any Custom setting, and ask whether a Switch 2 submission needs anything extra (no console Raid run has been submitted yet).
4. Switch 2 frame rate or performance mode options, and whether frame rate affects zoop strength.
5. Keep hole, TexasPete Fragments line and FastTipsGaming launch on the current build.
6. Rune totals per run; whether a cancelled cast costs runes.
7. Whether closing the software resets raid progress the way force-closing does on PC.
