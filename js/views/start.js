// Start here — step by step from wherever you are in a new world (picked at the top) to
// the app's practice loop. Ticks are saved in store.start so the page remembers where you are.
import { h, fill } from '../lib/util.js';
import * as store from '../lib/store.js';

export const title = 'Start here';

const W = 'https://dragonwilds.runescape.wiki/w/';

// Each step: id, heading, lines, optional [href, label] into the app, sources.
const PHASES = [
  {
    id: 'walk', title: '1 · Walk to the raid gate',
    intro: 'The raid gate is in the north of the map, in the Fractured Plains of Ghornfell. Bramblemead Valley, with Bramblemead Village at its centre, lies south of the Whispering Swamp and west of the Fractured Plains.',
    steps: [
      ['temple', 'Leave the starting temple for Bramblemead Village', ['A new world starts you in a ruined temple in Temple Woods with the Wise Old Man. Finish the tutorial with him, or skip it. Skipping sends you to meet him in Bramblemead Village, close by in the valley below.'], null, [W + 'Guide_for_new_players']],
      ['village', 'Talk to the Wise Old Man in Bramblemead Village', ['He is on the first floor of a ruined building at the far, north-east end of the village. Talking to him there finishes First Steps and offers Dragon Slayer.'], null, [W + 'First_Steps', W + 'Bramblemead_Village']],
      ['swamp', 'Go north out of the valley into the Whispering Swamp', ['The Whispering Swamp is directly north of Bramblemead Valley. There is a bridge at the centre of the swamp.'], null, [W + 'Bramblemead_Valley', W + 'Whispering_Swamp']],
      ['pass', 'Leave the swamp by its eastern side, through King\'s Pass, into Ghornfell', ['King\'s Pass is the way from the Whispering Swamp into Ghornfell. Since 0.9.3 the eastern side of the swamp is the easier way in.', 'There is no lodestone on this route, so the first trip is on foot. On Creative nothing attacks you, and only a fall can hurt you.'], null, [W + 'Ghornfell', W + 'Whispering_Swamp']],
      ['plains', 'Cross the Fractured Plains to Velgar\'s Rise, then go north-west of it', ['The Fractured Plains are just north of the swamp, and Velgar\'s Rise is at their centre. The gate is north-west of Velgar\'s Rise, near the northern edge of the plains.'], null, [W + 'Fractured_Plains', W + 'Regicide']],
      ['gate', 'Interact with the Dragon Gate and choose "journey into the Scorned Wilderness"', ['The gate says "the blood of the four seal the gate". On a normal world it opens only after Icthlarin\'s Little Helper is complete, and opening it starts Regicide.', 'On Creative the wiki does not say whether it opens. If it opens, Creative is your practice world, with every recipe, building piece and skill already unlocked and spells free of runes and cooldowns. If it stays shut, practise on a world that has finished Icthlarin\'s Little Helper. The Hardcore page is that quest line.'], ['#/hardcore', 'Hardcore quest line'], [W + 'Regicide', W + 'Scorned_Wilderness', W + 'Creative_Mode']],
    ],
  },
  {
    id: 'hub', title: '2 · Set up in Rasthin\'s Rest',
    intro: 'Rasthin\'s Rest is the raid hub and the only place in the Scorned Wilderness where you can build.',
    steps: [
      ['bed', 'Build a bed under a roof with three walls', ['A claimed bed here means a death sends you back to the hub, not to the Wise Old Man\'s temple. A bed is 8 ash planks and 4 rough cloth.'], null, [W + 'Bed', W + 'Death']],
      ['kit', 'Make the run kit', ['Fleet Foot Infusion, which halves the stamina cost of sprinting.', 'A mace, a two-handed mage staff and mage armour, for the Thane kill and the Heart.', 'Windstep, Surge and one targeted area spell on your spell ring. The dive cancel and the flight both need that area spell.', 'Run → Pre-flight in the app is the same list, with tick boxes for each attempt.'], ['#/run', 'Open Pre-flight'], [W + 'Scorned_Wilderness']],
      ['zily', 'Talk to Commander Zilyana to start a raid', ['She sends you to Dragontail Vines, the first zone. The zones in order are Dragontail Vines, Fragments of Ghornfell, The Shattered Stronghold, Cataclysm Keep and Kuldra\'s Sanctum.', 'Talking to her again later lets you start a new run or go back to the one you are on.'], ['#/route', 'Route, split by split'], [W + 'Scorned_Wilderness']],
    ],
  },
  {
    id: 'phone', title: '3 · Put this app beside the game',
    intro: 'The app is the second screen. It runs offline once installed, except for clips and the live leaderboard.',
    steps: [
      ['install', 'Install the app on your phone', ['On a Pixel in Chrome, open the ⋮ menu and choose Install app, or tap ⤓ Install app at the top of this page. Folded, it uses the phone layout. Unfolded, it switches to the side-rail layout.'], null, []],
      ['tap', 'Use the on-screen buttons', ['The J, K and Space keys only work with a keyboard. On the phone, every one of them has a button on the page.'], null, []],
      ['voice', 'Turn on 🔊 Call-outs in Run', ['Each split is spoken with its time and your pace against the comparison you picked, so your eyes can stay on the game.'], ['#/run', 'Run navigator'], []],
    ],
  },
  {
    id: 'loop', title: '4 · The practice loop',
    intro: 'Go round this loop each session. Today builds itself from what you logged last time, so each pass starts on your weakest skip.',
    steps: [
      ['today', 'Open Today', ['It lists your four least-made skips, your best time on each split against the gold target pace, and your best run of the day.'], ['#/today', 'Today'], []],
      ['practice', 'Drill the top skip in Practice', ['Tap the skip and loop its reference clip until the inputs make sense. Then try it in the game and tap ✓ Made it or ✗ Missed after every attempt.', 'The list re-sorts so your weakest skip stays on top. Next suggested jumps to it.'], ['#/practice', 'Practice'], []],
      ['split', 'Time single splits in Run', ['Tap a split in the list under Start run. The giant button reads START, then SPLIT when you reach the extraction banner, then AGAIN.', 'Go again until your best on that split is at or under the gold target on Today.'], ['#/run', 'Run navigator'], []],
      ['full', 'Do a full run', ['Tap Start run on the first frame the loading icon disappears as you enter the raid.', 'Tap SPLIT each time "EXTRACTION POINT UNLOCKED" appears, and on the cut to black after "GET OUT NOW!" once Kuldra\'s Heart dies.', 'The screen shows the skip you are on, its steps and a muted clip, plus your live time against TexasPete\'s 6:50.'], ['#/run', 'Run navigator'], []],
      ['race', 'Race your splits against the record', ['After a finished run, tap Race your splits. It puts your run beside the record runs split by split and shows where the time went.', 'That split, and the skip inside it, is what you take into Practice on the next pass.'], ['#/compare', 'Race the WR'], []],
    ],
  },
  {
    id: 'submit', title: '5 · A run that counts',
    intro: 'For the speedrun.com Raid board.',
    steps: [
      ['record', 'Record every attempt', ['Every run on the board needs video, and moderators check each one. The timer starts on the first frame the loading icon disappears going into the raid. It ends when the screen goes black after the "Get out now!" timer.'], null, []],
      ['lss', 'Export your splits', ['Every finished run is saved in Timer. Timer exports a LiveSplit file with the record, Nanobit and the community sum of best as comparisons.'], ['#/timer', 'Timer'], []],
    ],
  },
];

const ALL = PHASES.flatMap(p => p.steps.map(s => `${p.id}.${s[0]}`));

// Where you are now: every step before the chosen place is left out.
const FROM = [
  ['walk.temple', 'In the starting temple (tutorial)'],
  ['walk.village', 'Bramblemead Village, tutorial skipped, not talked to the Wise Old Man yet'],
  ['walk.swamp', 'Bramblemead Village, already talked to the Wise Old Man'],
  ['walk.pass', 'In the Whispering Swamp'],
  ['walk.plains', 'In Ghornfell / the Fractured Plains'],
  ['walk.gate', 'At the Dragon Gate'],
  ['hub.bed', 'Inside Rasthin\'s Rest'],
  ['loop.today', 'Set up, ready to practise'],
];
const startOf = st => ALL.indexOf((st && st.from) || ALL[0]);
const live = st => ALL.slice(Math.max(0, startOf(st)));

// For HQ: steps left from where you said you are.
export function progress() {
  const st = store.get().start || {};
  const keys = live(st);
  const n = keys.filter(k => st[k]).length;
  return { done: n, total: keys.length, from: st.from };
}

export function mount(root) {
  const done = () => store.get().start || (store.get().start = {});
  const bar = h('div', { class: 'st-bar' }, h('i'));
  const count = h('span', { class: 'pill' });
  const paintBar = () => {
    const keys = live(done());
    const n = keys.filter(k => done()[k]).length;
    bar.firstChild.style.width = `${(100 * n) / keys.length}%`;
    fill(count, `${n} / ${keys.length} done`);
  };

  const nextUp = () => live(done()).find(k => !done()[k]);

  root.append(h('div', { class: 'pagehead', 'data-read-main': '' }, h('div', {},
    h('h1', {}, 'Start here'),
    h('p', {}, 'Step by step from wherever you are in a new world to a practice loop for the raid. Pick where you are now, then tick each step as you finish it. The page remembers and opens on the next one.'))));
  const fromSel = h('select', { 'aria-label': 'Where are you now', style: { width: '100%' }, onchange: () => { store.update(s => { (s.start ||= {}).from = fromSel.value; }); paintAll(); jump(); } },
    FROM.map(([k, label]) => h('option', { value: k, selected: k === (done().from || ALL[0]) }, label)));
  root.append(h('section', { class: 'card', style: { marginBottom: '14px' } }, h('h2', {}, 'Where are you now?'), fromSel,
    h('p', { class: 'note', style: { margin: '8px 0 0' } }, 'Steps before this place are left out. Change it at any time.')));
  // The guide prompt for Gemini: guide/Raid Lab Guide.smile, copied whole in one tap.
  const GUIDE = 'guide/Raid%20Lab%20Guide.smile';
  const copyBtn = h('button', { class: 'btn pri', onclick: async () => {
    try {
      const text = await (await fetch(GUIDE)).text();
      await navigator.clipboard.writeText(text);
      fill(copyBtn, '✓ Copied, paste it into Gemini');
    } catch (e) { fill(copyBtn, 'Copy did not work, open the guide instead'); }
  } }, '✦ Copy the guide');
  root.append(h('section', { class: 'card', style: { marginBottom: '14px' } }, h('h2', {}, 'Ask Gemini about this app'),
    h('p', { class: 'note', style: { margin: '0 0 10px' } }, 'The Raid Lab Guide is this whole app, and the way into the raid, written as a prompt. Copy it, then in the Gemini app paste it as the instructions of a new Gem, or as the first message of a chat. Pick any model in Gemini\'s model picker and ask it anything about using the app.'),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, copyBtn, h('a', { class: 'btn', href: GUIDE, target: '_blank', rel: 'noopener' }, 'Open the guide'))));
  root.append(h('div', { class: 'row', style: { marginBottom: '14px', gap: '10px', alignItems: 'center' } }, bar, count,
    h('button', { class: 'btn sm', onclick: () => { if (confirm('Untick every step?')) { store.update(s => (s.start = { from: (s.start || {}).from })); paintAll(); } } }, 'Reset')));

  const body = h('div', { class: 'st-list' });
  root.append(body);

  function paintAll() {
    const next = nextUp();
    const keep = new Set(live(done()));
    fill(body, PHASES.filter(p => p.steps.some(s => keep.has(`${p.id}.${s[0]}`))).map(p => h('section', { class: 'card st-phase' },
      h('h2', {}, p.title), h('p', { class: 'note' }, p.intro),
      h('ol', { class: 'st-steps' }, p.steps.filter(s => keep.has(`${p.id}.${s[0]}`)).map(([sid, head, lines, link, src]) => {
        const key = `${p.id}.${sid}`;
        const on = !!done()[key];
        return h('li', { class: 'st-step' + (on ? ' ok' : '') + (key === next ? ' cur' : ''), id: `st-${p.id}-${sid}` },
          h('label', { class: 'st-head' },
            h('input', { type: 'checkbox', checked: on, onchange: e => { store.update(s => { (s.start ||= {})[key] = e.target.checked || undefined; }); paintAll(); } }),
            h('b', {}, head), key === next ? h('span', { class: 'pill warn' }, 'next') : null),
          h('div', { class: 'st-body' },
            lines.map(t => h('p', {}, t)),
            link || src.length ? h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
              link ? h('a', { class: 'btn sm pri', href: link[0] }, link[1] + ' ›') : null,
              src.map(u => h('a', { class: 'note', href: u, target: '_blank', rel: 'noopener' }, decodeURIComponent(u.replace(W, 'wiki: ')).replace(/_/g, ' ')))) : null));
      })))));
    paintBar();
  }
  function jump() {
    const n = nextUp();
    if (n && n !== live(done())[0]) requestAnimationFrame(() => { const el = document.getElementById('st-' + n.replace('.', '-')); if (el) el.scrollIntoView({ block: 'center' }); });
  }
  paintAll();
  jump();
}
