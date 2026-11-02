// Hardcore 1 -> Max route (from the original site), clips re-timed to the creators'
// own chapter markers on 2026-11-02. approx:true marks the only remaining estimate.
export const PHASES = [
{
  id:'p0', title:'Phase 0 — Fresh Hardcore account (you are here)', sub:'Temple Woods · Power level 1 · first 20 minutes',
  intro:'You have killed a rat. That is First Steps underway. Everything in this phase is about never dying before you have a bed, because Hardcore deletes the character and a gravestone only exists once a bed does.',
  kv:[['Deaths allowed','0'],['Target level','Agility 8, Runecrafting 8'],['Exit condition','Bed placed, Windstep cast once']],
  segs:[
   {t:'Hardcore rules you are now bound by', why:'Three mechanics decide every routing choice in this run. Read once, then they are repeated at each danger point.',
    clips:[], steps:[
     ['One active gravestone at a time. A second death before you loot the first deletes the first grave\'s contents.','Hardcore-specific. On Normal you can stack graves.'],
     ['Your equipped armour stays on your body on death; your entire backpack drops into the gravestone.','Carry only what the next segment needs.'],
     ['Gravestone from a death inside a Dragonkin Vault is placed at the vault entrance, not inside.','Vaults are the safest place to risk a death in the early game.'],
     ['Eating is disabled in the spirit realm (Fellhollow / Imaru) on Hardmode. Two skeleton hits are fatal there.','Plan Internal Alchemy (Cooking 20) before Fellhollow.'],
     ['Recall (Agility 57) and Reactive Recall (Agility 70) return you safely from a fatal fall and consume the tether. Fall deaths stop being run-enders at 70.','This is the single biggest Hardcore safety unlock and it is why Agility is pushed early.']
    ]},
   {t:'First Steps → Getting Started (Doric) → Ratcatcher (Vannaka) → Rune Mysteries (Zanik)', why:'These four tutorial quests gate Dragon Slayer, which gates everything. Doing them in order is faster than exploring because each hands you a station or a spell.',
    clips:[{vid:'Z7N5NKvNTGM',label:'ItsRoasty — early WR opening route (first 4 min)',in:0,out:240,approx:true}], steps:[
     ['Finish First Steps in Temple Woods (the rat you killed counts). Pick up every branch and stone on the way; do not detour for them.','Woodcutting hits trees, saplings and floor logs equally at this stage.'],
     ['Speak to Doric just outside the temple → Getting Started. Build the crafting table and the bed the moment it asks.','The bed is your first gravestone insurance. Nothing else matters until it exists.'],
     ['Speak to Vannaka near the old windmill → Ratcatcher. Fight rats only; walk around goblins.','Goblins are power 1 but a pack can kill a level-1 character with no armour.'],
     ['Speak to Zanik on the path to Bramblemead Valley → Rune Mysteries. This gives the Rune Altar and your first Air Runes.','Runecrafting 1 = Air Rune recipe. Harvest every glowing essence deposit you pass.'],
     ['Reach Runecrafting 8 → Windstep (5 Air). Cast it once on flat ground to learn the arc.','Windstep is 16 m of jump height. From here on you never walk up a cliff.'],
     ['Reach Agility 10 → Double Jump. Agility levels itself by moving; sprint everywhere.','Double Jump chains into Air Dash at 32. These two are the whole early movement kit.']
    ]},
   {t:'Build the Bramblemead logistics hub', why:'Your base is not a house, it is a Lodestone hop and a chest. Every later phase returns here for one minute and leaves.',
    clips:[], steps:[
     ['Place the base in Bramblemead Valley within sight of the Wise Old Man (Dragon Slayer start).','All three Brynmoor vaults and all tutorial NPCs are within a Windstep run of this point.'],
     ['Build: bed, crafting table, tannery, cooking fire, one chest. Nothing decorative.','Construction XP from these is enough for the next step.'],
     ['Do not build walls. Build a roof over the bed only.','Rest is restored under a roof. Walls cost stone you need for the Lodestone.'],
     ['Start a stone and rune-essence pile for the first Lodestone (32 Stone, 20 Rune Essence, 1 Vault Core).','The Core comes from the next segment.']
    ]}
  ]
},
{
  id:'p1', title:'Phase 1 — Brynmoor vaults and the first Lodestone', sub:'Power level 2 · three vaults · ~9 Vault Cores',
  intro:'Brynmoor has three level-2 vaults and each drops around three Vault Cores on a three-day respawn. Cores are the only currency that matters: Lodestone, Blacksmith\'s Bench, Fletching Bench, Personal Chest all cost one. Run all three vaults before Dragon Slayer.',
  kv:[['Vaults','Crasorak Kara → Thishepen Kara → Vertentis Kara'],['Cores target','9'],['Exit condition','Lodestone at base + Blacksmith\'s Bench']],
  segs:[
   {t:'Crasorak Kara — Temple Woods North vault', why:'Shortest vault in the game and the one the tutorial walks you past. Three Cores. Death inside puts the grave at the entrance, so this is where you learn trap timing at no risk.',
    clips:[{vid:'cLC3khNU1_Q',label:'North vault — path to the entrance',in:8,out:144},{vid:'cLC3khNU1_Q',label:'North vault — full clear, all cores',in:144,out:718},{vid:'cLC3khNU1_Q',label:'North vault — boss + final core',in:650,out:718},{vid:'9pdhP9cHL1Y',label:'Hidden chamber',in:0,out:65},{vid:'4atswj1YzUE',label:'Final locked gate',in:0,out:161}], steps:[
     ['Approach via the lower path to the cliff, Windstep up to the vault mouth (blue-and-white flag on the map).','Without Windstep you cannot reach it. This is why Runecrafting 8 came first.'],
     ['Central room → hallway with the fire-dart trap. Walk the wall opposite the darts; they fire on a fixed cadence, count two and go.',''],
     ['Patrolling Vault Guardian room. Parry, do not roll — parry costs less stamina and you have almost none.','Guardian is a parry tutorial. Three parries and a combo kills it.'],
     ['Take the Vault Core from the central pedestal.','Core 1.'],
     ['Right-hand room: kill the Giant Rat, take the Core by the Dragonkin Effigy, pull the lever to reopen the main room.','Core 2. The lever is mandatory or you walk back through the trap.'],
     ['North from the main room into the corridor with floor spikes and wall darts. Jump the plates, hug the dart side when they reset.','Third Core and the final chest are past this.'],
     ['Hidden chamber and final locked gate — see clips 2 and 3. Both are optional on a speed route; take them on the three-day re-run, not now.','Chest loot here is cosmetic to the route.']
    ]},
   {t:'Thishepen Kara — Bramblemead Valley vault', why:'Two Cores and the Vault Archon. The Archon is the first enemy that punishes rolling; it is the parry check before Velgar.',
    clips:[{vid:'lF9h8FaQx44',label:'Temple Woods South vault — full clear (MetaForge)',in:65,out:425},{vid:'lF9h8FaQx44',label:'South vault — boss',in:340,out:397}], steps:[
     ['Enter with full Rest and at least four cooked fish. Nothing else in the backpack.','Hardcore: an empty backpack is a worthless gravestone.'],
     ['Trap corridors here use collapsing floors. Double Jump across, never walk the centre line.',''],
     ['Vault Archon: it winds up visibly; parry on the second frame of the wind-up, not the first. Two parry-punish cycles.','This is the parry timing you reuse on Velgar\'s tail sweep.'],
     ['Collect both Cores. The Staff of Light recipe is tied to the Highlighting the Problem side quest — skip the quest for now.','Side quests are Phase 7 content.']
    ]},
   {t:'Vertentis Kara — Whispering Swamp vault (Rat King and Plague King)', why:'Seven chests, two Cores, and the Wolfbane Dagger / Necromancer\'s Staff / Fallen Hoplite\'s Helm — the best pre-bronze gear in the game. This vault is worth its full clear.',
    clips:[], steps:[
     ['Go in with the Bone Club from the tannery and the Fallen Hoplite pieces if you already have any.','Bone Club is the best starter melee until bronze.'],
     ['Poison rocks and exploding plants in the swamp corridors — Windstep over them, do not fight through.',''],
     ['Rat King then Plague King. Plague King applies poison; keep one antidote brew or accept the tick and burst him in his stun window.','Hardcore: poison tick plus a hit is the death pattern here. Bank the Cores from the first two vaults before this one.'],
     ['Loot all seven chests. Equip Wolfbane Dagger or Necromancer\'s Staff by combat style.','Staff if you plan a magic-leaning Kuldra route; dagger otherwise.']
    ]},
   {t:'Spend the Cores', why:'Nine Cores become the three structures that remove base trips for the rest of the run.',
    clips:[], steps:[
     ['Lodestone at base (32 Stone, 20 Rune Essence, 1 Core). Second Lodestone comes in Ghornfell.','You need two Lodestones to hop. One at home, one wherever you are mining.'],
     ['Blacksmith\'s Bench (1 Core) — needed for bronze the moment you hit Ghornfell.',''],
     ['Fletching Bench (1 Core) if ranged; otherwise hold the Core for the Ghornfell Lodestone.',''],
     ['Keep two Cores in the chest for Personal Chest (Construction 40) later.','Personal Chest = chest access from anywhere, no base trips, for the rest of the run.']
    ]}
  ]
},
{
  id:'p2', title:'Phase 2 — Ghornfell, bronze → iron, Dragon Slayer, Velgar', sub:'Power level 3–4 · first dragon',
  intro:'Ghornfell gives bronze then iron and ends with General Velgar at power level 4. The speed route takes Velgar with ranged gear in under two minutes; the Hardcore route takes him with full food and a Lodestone outside the arena.',
  kv:[['Skill targets','Attack 11 (Tempest Shield), Magic 11 (Surge), Mining 11, Woodcutting 11, Agility 32'],['Boss','General Velgar PL4'],['Exit condition','Velgar dead, iron set, Ghornfell Lodestone']],
  segs:[
   {t:'Breakpoint sweep — the level-11 power spike', why:'Four spells unlock at level 11 across four skills and together they are the largest single jump in the game. Get all four before touching Velgar.',
    clips:[], steps:[
     ['Attack 11 → Tempest Shield (15 Air): hold to block all damage, burst on release. Attack level extends duration.','This is your Hardcore panic button for the entire run.'],
     ['Magic 11 → Surge (10 Astral + 10 Law, 45 s cooldown): dodges travel further and last longer.','Runecrafting 13 for Astral and 16 for Law runes gate this. Push Runecrafting to 18 (Nature) in the same session.'],
     ['Mining 11 → Rocksplosion (15 Earth + 5 Fire): breaks a boulder cluster in one cast.','Earth runes at Runecrafting 11.'],
     ['Woodcutting 11 → Axtral Projection (10 Air + 5 Astral): one cast fells every tree in a line.','Line up three trees, one cast. Wood is solved for the run.'],
     ['Agility 22 Hopper, 27 Common Burrower (Brynmoor + Ghornfell burrow fast travel), 32 Air Dash.','Air Dash is the gap-crosser; from 32 you stop pathing around terrain.']
    ]},
   {t:'Bronze → iron, Ghornfell Lodestone, four Ghornfell vaults', why:'Iron is the Velgar minimum. The four Ghornfell vaults (power 3–4) are where the Cores for Personal Chest and the second Lodestone come from.',
    clips:[], steps:[
     ['Drop the second Lodestone at the Ghornfell mining area the moment you have a Core. Now you can hop.','Resupply trips go from ~20 min to ~10 min.'],
     ['Rocksplosion the copper/tin then iron nodes. Smelt at base via Lodestone hop. Full iron set and an iron weapon in your style.',''],
     ['Run the Ghornfell vaults for Cores. Skeklac drops the Granite Maul if you are going 2H.','Granite Maul carries melee through Fellhollow.'],
     ['Cooking 20 → Internal Alchemy (10 Nature): refreshes every active food buff without eating.','Mandatory before Fellhollow (eating disabled in the spirit realm on Hardmode).']
    ]},
   {t:'General Velgar — the fast kill', why:'Velgar in 86 seconds with the best current ranged gear is the benchmark. The pattern is spam-dive through the spike volleys, jump the poison pools, and only attack in the landing window.',
    clips:[{vid:'-rkmjIK1EeI',label:'Velgar dies in 86 seconds (ranged)',in:0,out:93},{vid:'REVKfEpm1C0',label:'Velgar boss guide (Tiger with the Bars)',in:0,out:218},{vid:'AbC4uyQRzcM',label:'Every boss guide — Velgar gear + fight',in:39,out:173}], steps:[
     ['Lodestone outside the arena. Bed at base with full Rest. Backpack: food ×8, one Tempest Shield rune stack, nothing else.','Hardcore: the grave lands outside if you die here; a second death before looting deletes it.'],
     ['Phase 1 — spike volleys: dive (dodge) through them, do not sidestep. Surge extends the dive past the whole volley.','Spam dive is the community-confirmed answer.'],
     ['Phase 2 — poison pools and fire breath: jump and Double Jump over pools; Windstep away from the breath cone.',''],
     ['Attack only when Velgar lands. Melee: parry the tail sweep (same timing as the Vault Archon), punish. Ranged: full volley into the head on landing.',''],
     ['Below 25% he stays grounded longer. Tempest Shield his frontal and burst.','Solo melee-only no-damage Velgar exists (Shadiochao) — the pattern is learnable.']
    ]}
  ]
},
{
  id:'p3', title:'Phase 3 — Fellhollow, steel, Imaru the Soul-Eater', sub:'Power level 5 · Withering Heights · Hardmode spirit realm rules',
  intro:'Fellhollow is where Hardcore runs die. Wither exposure drains supplies, the spirit realm disables eating, and two skeleton hits kill. The Windstep spectral cancel on Imaru is the single most important trick in this phase.',
  kv:[['Skill targets','Agility 42 (Wild Burrower), 44 (Phase Dash), Construction 40 (Personal Chest), Artisan 56 (Magical Mending)'],['Boss','Imaru PL5'],['Exit condition','Imaru dead, steel set']],
  segs:[
   {t:'Arrive cleansed, lightly loaded, with Wild Burrower', why:'Agility 42 opens the Fellhollow burrow network and reduces burrow damage. Without it you walk the Wither.',
    clips:[], steps:[
     ['Agility 42 before entering. Phase Dash at 44 is the next target — a second airborne dash, ~3 extra double-dashes per 30 s.','Phase Dash is the raid skip enabler later. Get it here.'],
     ['Construction 40 → Personal Chest (15 Astral + 20 Law). From now on you never return to base to unload.',''],
     ['Blast Furnace (Vault Core) for steel. Steel weapon + steel armour before Imaru.',''],
     ['2H Hammer or Zombie Axe + Granite Whetstones + Wind weapon enchant for skeleton packs.','AoE clears are how you survive the Lake of Lost Souls.']
    ]},
   {t:'Imaru the Soul-Eater — Hardmode', why:'Two skeleton hits are fatal, eating is disabled in the spirit realm. The known trick: cast Windstep at the exact moment Imaru turns spectral and the phase transition cancels — no necromancer spawns.',
    clips:[{vid:'AbC4uyQRzcM',label:'Every boss guide — Imaru gear, attacks and phases',in:216,out:501}], steps:[
     ['Internal Alchemy (Cooking 20) cast at the arena door with all buffs up. This is your only "eating" inside.','Hardmode spirit realm disables food.'],
     ['Dorgeshuun / Bone Crossbow + Tempest Shield for block-invulnerable ranged windows; Confuse (Magic 30) on skeleton adds so they fight each other.',''],
     ['Watch for the spectral wind-up. The frame she starts to fade, cast Windstep. If timed, she snaps back and the necromancer never appears.','Timing exploit, community verified (BIGJOE Hardmode solo, GAMINGFILMLLC no-deaths).'],
     ['Never take two hits in a row. One hit → Tempest Shield → reset.','Hardcore rule for this whole fight.']
    ]}
  ]
},
{
  id:'p4', title:'Phase 4 — Dowdun Reach, mithril, Black Knight Titan', sub:'Power level 6 · Tower Climb unlocks at Agility 51',
  intro:'Dowdun Reach is the shortest phase. Mithril, Black Knight\'s Fortress, the Titan, and the Library where Tower Climb lives. Agility 57 Recall arrives here and your fall-death risk drops to near zero.',
  kv:[['Skill targets','Agility 51 (Dowdun courses), 53 (Stamina Potion), 57 (Recall), Woodcutting 52 (Trunk Totem)'],['Boss','Black Knight Titan PL6'],['Exit condition','Titan dead, mithril set, Recall learned']],
  segs:[
   {t:'Recall and the Tower Climb', why:'Recall (30 Air + 15 Law) places a beacon; a fatal fall while tethered teleports you back and consumes the tether. From Agility 57 you can attempt any vertical skip with a safety net.',
    clips:[], steps:[
     ['Agility 57 → Recall. Cast before every skip attempt from now on.','Reactive Recall at 70 makes it automatic.'],
     ['Tower Climb (Agility 51, Windstep + Air Dash + Double Jump). Record pace is vertical Windstep scaling with aerial dash chains; 1.0.1 jump-attack cancel saved ~3 s.','Platinum 60 s; WR 46.5 s (dotyoureyes).'],
     ['Woodcutting 52 → Trunk Totem (30 Nature + 10 Law): scattered trunks into one totem, then Splinter. Wood for the Kuldra prep is one session.','']
    ]},
   {t:'Black Knight Titan', why:'Betrayal crucible later pairs the Titan with an Abyssal Demon, so learn his pattern cleanly here.',
    clips:[{vid:'AbC4uyQRzcM',label:'Every boss guide — Black Knight Titan',in:501,out:689}], steps:[
     ['Mithril weapon, mithril armour, Mage Hat if you have one (−50% stamina regen delay).','Mage Hat + melee body/legs is the 1.0.1 meta.'],
     ['Parry the overhead, punish the recovery. Roll only the ground slam.',''],
     ['Enchant Weapon: Air (Attack 30) for attack speed.','']
    ]}
  ]
},
{
  id:'p5', title:'Phase 5 — Umbral Sands, adamant, Fuzan, Nightmare Crucibles', sub:'Power level 7 · Fire Cape · Ascension Cores',
  intro:'Umbral Sands is the pre-raid gear phase. Fuzan and the 30-wave Fight Caves give the Fire Cape; the four Nightmare Crucibles give Ascension Cores to upgrade from Power Level 6 to 7. Lava Fields (Agility 65) is here too.',
  kv:[['Skill targets','Agility 65–70, Magic 61 (Enfeeble), Attack 50 (Enchant Water)'],['Bosses','Fuzan, 4 Crucibles'],['Exit condition','Fire Cape, PL7 weapon, Phase Dash + Reactive Recall']],
  segs:[
   {t:'Fight Caves 30 waves + Fuzan', why:'Stamina and tiredness constraints across 30 waves. TropV did it no-magic; playfulcloud6424 did Hard Mode Fuzan. The Fire Cape is the reward.',
    clips:[{vid:'AbC4uyQRzcM',label:'Every boss guide — Fuzan + Fight Cave',in:689,out:991}], steps:[
     ['Stamina Potion (Agility 53) stops sprint drain across waves.',''],
     ['Enchant Weapon: Water (Attack 50) spawns healing orbs — the sustain for 30 waves.',''],
     ['Fuzan: Tempest Shield the fire phase, Surge out of the lava ring, attack in the stagger.','']
    ]},
   {t:'All four Nightmare Crucibles — Ascension Cores', why:'Roonz / 808Stat3 clear all four in ~14:37–15:00. Each is a boss pairing: Green Dragon + 2 Garou Thanes; Black Knight Titan + Abyssal Demon; 2 Zombie Ogres; Blue + Green + Red Dragons at once.',
    clips:[], steps:[
     ['Order: Hounded (ogres) → Betrayal (Titan + Demon) → Hopelessness (Green Dragon + Thanes) → Humiliation (three dragons).','Easiest to hardest for a Hardcore first clear.'],
     ['Confuse / Greater Confuse on the Thanes and the ogres so they fight each other.',''],
     ['Humiliation: Snare one dragon, Windstep away from the other two\'s breath, kill one at a time. Reactive Recall on.',''],
     ['Spend Ascension Cores on the weapon of your Kuldra style. PL6 → PL7.','']
    ]}
  ]
},
{
  id:'p6', title:'Phase 6 — Scorned Wilderness raid and Queen Kuldra', sub:'Runite · the live speedrun category · 6:50 world record',
  intro:'The raid is where every movement discovery from the run pays off. Icthlarin\'s Little Helper then starting Regicide gates entry; the entrance is north-west Fractured Plains in Ghornfell. The record lineage is ChiefWes 9:37 → Nimblesk 8:28 → TexasPete 7:40 → TexasPete 6:50 (14 Oct 2026). Learn the follow-along route first, then layer skips.',
  kv:[['Gate','Icthlarin\'s Little Helper complete, Regicide started'],['WR','TexasPete 6:50 (1.0.0.6+)'],['Exit condition','Kuldra dead, PL9 gear farmed']],
  segs:[
   {t:'Follow-along route (post-patch, ~11 minutes)', why:'SamFPlays\' route is the one to learn first. It uses windstep to the crystals under the bridge and the second air-dodge timed as the invisible wall pushes you off.',
    clips:[{vid:'WpvNjqVmpVM',label:'11 min full Kuldra speedrun — follow along (1.0.1)',in:0,out:661.9},{vid:'ESrrkdxD1fo',label:'Every 1.0.1 skip explained (SamFPlays)',in:103,out:758},{vid:'68ovg9A_PpA',label:'New raid skips after 1.0.1 (Channel Xero)',in:0,out:894}], steps:[
     ['Bed and respawn placement before the run. heartlessedly lost a sub-5 to a bed — respawn point is part of the route.',''],
     ['From Commander Zilyana\'s checkpoint: Windstep to the crystals under the bridge rather than crossing it.',''],
     ['At the invisible wall: first air dodge into the wall, second air dodge / wave-dash the instant it starts pushing you back. Momentum carries through.','This is the primitive every skip is built on.'],
     ['Dragontail Vines skip → Updated Jump Puzzle skip → Shattered Stronghold skip (CrossRSDW post-1.0.1 set).',''],
     ['Fog barriers after 1.0.1 only clear after bridge puzzles — the route in the clip accounts for that.','']
    ]},
   {t:'Record lineage — study the three WR runs', why:'ChiefWes found the map-reset skip; TexasPete borrowed the techniques and went 7:40 then 6:50 before the windstep double-jump existed. Watch them at 0.5× for the inputs.',
    clips:[{vid:'RFY6kDdxHOg',label:'ChiefWes 9:37 — original 1.0.0.6+ WR',in:0,out:603.1},{vid:'6N3NwYA5Zh0',label:'TexasPete 7:40 — ex-WR',in:0,out:526.2},{vid:'6WEIHo7AUf0',label:'TexasPete 6:50 — current WR, with commentary',in:0,out:444.3},{vid:'doVQ9Ph256g',label:'Nanobit 7:01 — 1.0.1 ruleset',in:0,out:464.9},{vid:'hDT7if6f9Ug',label:'heartlessedly 5:02 — Pre-1.0.0.6 (patched skips)',in:0,out:348}], steps:[
     ['Watch 9:37 for the map-reset skip and the overall route.',''],
     ['Watch 7:40 at 0.5× for Phase Dash usage between islands.',''],
     ['Watch 5:02 to understand what the Legacy skips were (extraction-zone teleport trigger, underground to the Heart) — most are patched but the movement is instructive.',''],
     ['Windstep double-jump is the strat found after 6:50. The next record uses it; practise it on Tower Climb first.','']
    ]},
   {t:'Kuldra — four phases', why:'Anima pylons, orbs, resonator cannon, laser sweeps, Heart. ThePuckington killed her with no armour and a wooden sword, so every phase is dodgeable.',
    clips:[{vid:'AbC4uyQRzcM',label:'Every boss guide — Kuldra first clear',in:991,out:1269},{vid:'7s3fgHwlRYA',label:'Complete Kuldra raid guide — boss phases',in:885,out:1163}], steps:[
     ['Phase 1 pylons: Windstep between them, Snare adds.',''],
     ['Phase 2 orbs: Surge through the gaps; Afterimage pulls the orb tracking.',''],
     ['Phase 3 resonator cannon and laser sweeps: Tempest Shield the sweep you cannot dodge, Phase Dash the rest.',''],
     ['Phase 4 Heart: all-in DPS. Enfeeble (Magic 61) first.',''],
     ['Farm the raid for PL9 gear. Hardcore: every re-run is a death risk — only run it with Reactive Recall and full food.','']
    ]}
  ]
},
{
  id:'p7', title:'Phase 7 — Skilling to 99 in all 13', sub:'1,000,000 XP per skill · Road to Max',
  intro:'With the story done, the run becomes XP per hour. Every gathering spell from earlier phases is a multiplier here. Two known XP exploits (Unstable Ground for Construction, Grill Funnel for Cooking) were published unpatched by Tiger with the Bars and are on Jagex\'s patch list — use them while they exist.',
  kv:[['Longest grind','Fishing'],['Fastest','Agility (passive, Nomad + Trailblazer)'],['Exit condition','13 × 99']],
  segs:[
   {t:'Order of skills', why:'Level the skills whose spells speed other skills first, so every later grind is faster.',
    clips:[{vid:'683KRPSLsPs',label:'100 days in Dragonwilds — long-form progression',in:0,out:4791}], steps:[
     ['Runecrafting to 68 (Earth Efficiency), 78 (Greater infusion duration), 87 (Nature Efficiency): auto-crafting yields go up for every other spell you cast.',''],
     ['Agility 48 Nomad (exploration XP 50→200) and 85 Trailblazer (200→400): Agility finishes itself while you do everything else.',''],
     ['Woodcutting: Axtral Projection → Trunk Totem → Splinter loops. Mining: Rocksplosion / Ultimate Burst, Divine Rock at 80 for a personal vein at base.',''],
     ['Fishing: Fishing Frenzy (10) doubles catches, Fishnado (55) pulls five per node, Infernal Rod (30) skips cooking. Longest grind — start it early and let it run alongside.',''],
     ['Farming: Uproot → Harvester radius, Rapid Growth (74), Mucksplosion (80). Cooking: Grill Funnel while unpatched.',''],
     ['Construction: Unstable Ground exploit while unpatched; otherwise Oak build pieces from Construction 18.',''],
     ['Combat skills finish naturally through raid farming and crucible re-runs.','']
    ]}
  ]
},
{
  id:'p8', title:'Appendix — PvP, movement tech, and what to watch for patches', sub:'Cross-applied discoveries from every sub-community',
  intro:'Everything here is already woven into the phases above; this is the index of where each discovery came from and what each patch has changed.',
  kv:[['Movement tech','jump-attack cancel · infinite double jump · auto-run start · wave-dash'],['Watch','Luminance (Dec 2026) adds Prayer and Elves'],['PvP','PVP ARENAS · Apeiron 3v3']],
  segs:[
   {t:'Movement tech index', why:'Found by the agility and raid speedrunners, applied everywhere.',
    clips:[], steps:[
     ['Jump-attack animation cancel (1.0.1, funkybasic) — cancels the whole landing sequence. Use after every landing in combat and traversal.',''],
     ['Infinite double jump (funkybasic thread, late Oct 2026, moderation pending) — if it holds, replaces Windstep casts on verticals.',''],
     ['Auto-run countdown start — already sprinting when a course timer begins. Any% only.',''],
     ['Wave-dash past invisible walls — second air dodge timed to the push-back. The raid skip primitive.',''],
     ['Windstep → Double Jump → Air Dash → Phase Dash chain — the full vertical kit.',''],
     ['Hazard pass-through — wind-dash through Lava Fields fire for zero damage.','']
    ]},
   {t:'PvP — what carries over', why:'Same substrate. Surge + Afterimage is the best PvP spell; Confuse does not affect players; several magic spells do no damage to players.',
    clips:[{vid:'9_TobOJT3s8',label:'1 hour to prepare — the three arena fights',in:784,out:1222}], steps:[
     ['Open Hardmode servers: full gear meta applies (Mage Hat, Ring of Life + Glory). PVP ARENAS equalizes gear so it is purely movement and stamina.',''],
     ['Fight near your own base, never theirs — gravestone and Hardcore single-grave rules apply in PvP too.',''],
     ['Snare → full crossbow volley. Windstomp drop-in from height as an opener.','']
    ]}
  ]
}
];

// Danger segments for the in-game run mode (hardcore-run.html): one hero line,
// a decision rule, and a pre-flight checklist, matched by segment title.
export const DANGER = {
 'Vertentis Kara':{line:'Rat King, then Plague King. Burst in the stun.',rule:'Poison tick + any hit = death pattern. <b>Poisoned → Tempest Shield, step out, burst in his stun window.</b>',chk:[['Cooked fish in pack','≥ 6'],['Antidote brew','≥ 1 or accept the tick'],['Cores from vaults 1–2','banked, not carried'],['Rest','full']]},
 'General Velgar':{line:'Dive the spikes. Hit only on landing.',rule:'<b>Spike volley → dive through it.</b> Pools → Double Jump. Attack only on landing. One hit taken → Tempest Shield.',chk:[['Lodestone outside arena','placed'],['Food','×8'],['Tempest Shield runes (Air)','≥ 45'],['Backpack','food + runes only'],['Bed at base','full Rest']]},
 'Imaru the Soul-Eater':{line:'Fade starts → Windstep. Never two hits.',rule:'<b>She starts to fade → cast Windstep NOW.</b> Two hits in a row = dead. One hit → Tempest Shield → reset.',chk:[['Internal Alchemy cast at door','buffs up'],['Food in spirit realm','disabled — none'],['Crossbow + Tempest runes','ready'],['Confuse runes (Astral)','≥ 25'],['Gravestone','empty']]},
 'Black Knight Titan':{line:'Parry overhead. Roll the slam.',rule:'<b>Overhead → parry.</b> Ground slam → roll. Everything else, stand and punish.',chk:[['Mithril weapon + armour','worn'],['Mage Hat','worn if owned'],['Food','×8'],['Recall tether','cast']]},
 'Fight Caves':{line:'30 waves. Shield fire. Surge the lava.',rule:'<b>Fire phase → Tempest Shield. Lava ring → Surge out.</b> Attack in the stagger only.',chk:[['Stamina Potion','≥ 2'],['Water enchant on weapon','applied'],['Food','×12'],['Recall tether','cast']]},
 'Nightmare Crucibles':{line:'Snare one. Kill one at a time.',rule:'<b>Three dragons → Snare one, Windstep from the breath, kill one at a time.</b> Reactive Recall on.',chk:[['Reactive Recall (Agility 70)','learned'],['Snare runes','≥ 2 casts'],['Confuse / Greater Confuse','ready'],['Food','×12'],['Gravestone','empty']]},
 'Follow-along route':{line:'Dodge, then dodge again on the push-back.',rule:'<b>At the invisible wall: dodge, then second dodge the instant it pushes back.</b> Missed → take the long path, do not retry mid-air.',chk:[['Bed / respawn point','placed at raid entrance'],['Phase Dash runes (Air/Astral)','≥ 3 casts'],['Reactive Recall','on'],['Food','×10'],['Patch of clip','1.0.1 — fog barriers active']]},
 'Kuldra':{line:'Shield the sweep. Dash the rest. Enfeeble, then Heart.',rule:'<b>Laser sweep you cannot dodge → Tempest Shield. Everything else → Phase Dash.</b> Heart phase: Enfeeble first, then all-in.',chk:[['Reactive Recall','on'],['Food','full stack'],['Tempest Shield runes','≥ 60 Air'],['Enfeeble runes','≥ 2 casts'],['Gravestone','empty']]}
};
export const dangerFor = seg => { for (const k in DANGER) if (seg.t.includes(k)) return DANGER[k]; return null; };
