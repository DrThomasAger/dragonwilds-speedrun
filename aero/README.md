# Aero

Frutiger Aero for any website, gathered in one folder: one style sheet, one script, and the Blog Template set on Aero glass. Nothing in this folder knows about any one site. Open `index.html` to see every piece working.

**Live specimen:** https://drthomasager.github.io/dragonwilds-speedrun/aero/

## Files

| File | What it is |
|---|---|
| `aero.css` | The whole style: tokens, wallpaper, glass, depth, controls, text, the sea. |
| `aero.js` | The moving parts: builds the sea and its dolphins, tilts elements toward the pointer, and drives the wallpaper parallax. |
| `blog-template.css` | The Blog Template (`DrThomasAger/drthomasager.com`, `assets/blog/blog.css`) with every rule scoped under `.bt`. Generated; do not edit. |
| `aero-blog.css` | Lays the Blog Template's paper and surfaces onto Aero glass. |
| `blog-template-sync.mjs` | Regenerates `blog-template.css` from the template: `node aero/blog-template-sync.mjs [blog.css] [out.css]`. |
| `index.html` | The specimen page: every class on one page. |

## Use it on a new site

Copy the folder in, or link the published copy at `https://drthomasager.github.io/dragonwilds-speedrun/aero/`.

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="aero/aero.css">
<!-- only for blog posts: -->
<link rel="stylesheet" href="aero/blog-template.css">
<link rel="stylesheet" href="aero/aero-blog.css">

<body class="aero-page">
  <section class="aero-window aero-slab aero-tilt">
    <h2 class="aero-caption">Title</h2>
    <div class="aero-pane aero-float">…</div>
    <button class="aero-btn aqua aero-candy">Go</button>
  </section>
  <article class="bt">…a post in the Blog Template…</article>

  <script type="module">
    import { initAero3D } from './aero/aero.js';
    initAero3D({ tilt: '.aero-tilt', max: 5, dolphins: 4 });
  </script>
</body>
```

A site with classes of its own (`.card`, `.btn`) keeps them and binds them to the `--aero-*` tokens in a file of its own, loaded after `aero.css`. The Raid Lab does this in `css/aero-app.css`, and that file is the worked example.

## The pieces

| Part | Classes | What they do |
|---|---|---|
| Page | `.aero-page` | An aurora wallpaper (green and aqua ribbons, light rays, bokeh) and a field of slowly rising bubbles, in two fixed layers behind everything. Both move at different depths with device tilt, the pointer and scroll. |
| Glass | `.aero-glass` (`.strong`), `.aero-window`, `.aero-caption`, `.aero-pane` | Frosted glass. Thin Vista glass about one third white with a deep blur, a dark outer and white inner edge, and a diagonal reflection. A glossy title bar split at the middle. Lighter glass for inside a window. |
| Depth | `.aero-slab`, `.aero-float`, `.aero-tilt` | A visible stacked edge thickness and a long floating shadow. A pane raised off the slab below it. Leaning toward a finger or the mouse (`aero.js` sets `--aero-rx` and `--aero-ry`). |
| Controls | `.aero-btn` (`.aqua` `.leaf` `.sun` `.berry`), `.aero-candy`, `.aero-orb`, `.aero-chip`, `.aero-bar`, `.aero-check`, `.aero-input`, `.aero-callout` | Glossy capsules, candy thickness that presses down, round glossy orbs, chips, a progress bar, a glossy check box, an inset input, a callout. |
| Text | `.aero-title`, `.aero-glow-text`, `.aero-extrude`, `.aero-gradient-text`, `.aero-bubble-text`, `.aero-sky-text` | A white glow behind dark text, extruded glossy lettering, a deep-blue-to-aqua gradient, candy bubble lettering (a light top half, a saturated lower half, a stroke, a rim and a dropped shadow), and white-to-sky lettering with an extruded edge for text on the wallpaper. The gradient fills draw their depth with `filter: drop-shadow`, which follows the glyphs. |
| Sea | `.aero-scene` (built by `aero.js`) | A sea band at the bottom of the page with moving waves and caustics. Glossy SVG dolphins leap in arcs from pods along it, with a splash ring at take-off and landing. |
| Still | | Everything stops under `prefers-reduced-motion`. |

## Type

`--aero-font` asks for Adrian Frutiger's **Frutiger** first, then his **Avenir Next** and **Avenir** (on Apple devices), then **Segoe UI** (Windows Vista and 7), then **Hind**. Frutiger is a licensed Linotype face, so no free web copy can be served. A device that has it installed shows it, and a page loads Hind from Google Fonts for devices that have none of the others.

## `initAero3D(options)`

| Option | Default | What it does |
|---|---|---|
| `tilt` | `'.aero-window'` | A selector. Every match gets `.aero-tilt`, including elements added later. |
| `max` | `5` | The largest lean in degrees. Tall elements lean less. |
| `dolphins` | `4` | How many dolphin pods (up to 6). |
| `scene` | `true` | Build the sea. |

It sets `--aero-gx` and `--aero-gy` (-1 to 1, from device tilt or the mouse) and `--aero-sy` (scroll in px) on `<html>`.

## Where it is used

- The Dragonwilds Raid Lab, every page and the Hardcore Run page (`css/aero-app.css` binds the app to it).
- The Raid Lab's Blog section sets the Beat 6:50 Ghost posts in the Blog Template on Aero glass (`js/views/blog.js`).

## Open

- Earlier Aero work that Hanjo describes is not in any repository this kit's author could reach: 14 of his repositories were searched on 2026-11-04. The Ghost theme itself is at `C:\Users\hanjo\Claude\Projects\Ghost Trial\site\content\themes\blog-template` and the Blog Template's own folder at `C:\Users\hanjo\Claude\Projects\Blog Template` (drthomasager.com `INHERITANCE.md`), both on his PC. When the earlier Aero work is pushed, it is folded into `aero.css` here.

## Hanjo's words that asked for it, verbatim

Recorded as he typed them, 2026-11-04 and 2026-11-05, in the Claude Code session that built this kit:

> also xhsnge style to reusable futiger aero dtyles

> its not enough layered transluscency snd windows xp era aero fx

> we have already done lots of work on ghost blogs and reusable aero dtyles you need to integrate

> its not 3D or 2.5D.inregrsrd.enough snd we need to use the font made ny thr fitiger aero guu, also add dolphins css snimsted

> Also stuff like gradients, bubbly text, shadow, all that stuff.

> xommit snx pizh so it xN be used by any guinor website making. gathee in foldee snd hsemonzis
