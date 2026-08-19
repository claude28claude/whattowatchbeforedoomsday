# What To Watch Before Doomsday

**The Doomsday Protocol** — a fan-made, deeply annotated Marvel watch order for
*Avengers: Doomsday* (18 December 2026).

**Live:** https://claude28claude.github.io/whattowatchbeforedoomsday/

## What it is

94 core entries across six parts, plus 27 optional extension entries. Every title
carries its runtime, director, streaming home, in-universe timeline placing,
post-credits count, first appearances, and a written answer to *why it is on the
list at all*.

- **Part I** — The Infinity Saga (24 films)
- **Part II** — The Street-Level Track (6 Netflix seasons)
- **Part III** — The Multiverse Saga (23)
- **Part IV** — The Older Universes (Blade, Ghost Rider, Raimi & Webb Spider-Man)
- **Part V** — The X-Men (the complete Fox catalogue, 17)
- **Part VI** — The Final Run (Phase 6)

Plus five separately tracked extension blocks — the Marvel One-Shots, Sony's
Spider-Man Universe, the Spider-Verse films, the Marvel Television era (Luke
Cage, Iron Fist, The Defenders, Agent Carter, Runaways, Cloak & Dagger,
Inhumans, Helstrom and the later Jessica Jones seasons) and the animated shelf — an "After Doomsday" timeline of everything
announced past December 2026, and a second countdown to *Avengers: Secret Wars*.

## Features

- **Two progress bars**: "the full experience" (the 55 Essential + Recommended
  titles Doomsday actually leans on, which contains all 15 of Disney+'s own
  official watchlist) above the complete 94-entry road
- Release order and timeline order
- Live countdowns to Doomsday, Endgame Encore and Secret Wars
- Progress saved in the browser, per title — adding entries never scrambles it
- Save/load progress to a file to move between devices
- Filters, search, jump-to-part, mark-a-whole-part-watched
- A finish-by-date pace planner
- A cast guide: all 38 announced Doomsday cast members, grouped by faction,
  with actor, a short backstory and which entry to meet them in
- Every official Doomsday video Marvel has released: four teasers, the full
  trailer and the D23 Special Look, each verified as a Marvel Entertainment
  upload rather than a fan re-upload
- A nostalgia shelf below them: Marvel's own retrospective compilations and the
  full 67-video Official Compilations playlist
- Keyboard accessible, screen-reader announced, print stylesheet

No build step, no dependencies, no tracking. Open `index.html`.

## Layout

It used to be one 205KB file, which made every edit expensive to reason about.
It is now four, split by concern:

| file | size | what it is |
|---|---|---|
| `index.html` | ~55 KB | markup and prose only |
| `styles.css` | ~44 KB | all styling |
| `data.js`    | ~71 KB | `PARTS`, `EXTENSIONS`, `POSTERS`, `COMPOSED` |
| `app.js`     | ~35 KB | rendering, state, countdowns, PWA wiring |

`data.js` declares globals and **must load before `app.js`**. Still plain static
files - no bundler, no transpile. Changing a colour means opening 44KB, not 205KB.

## Install it as an app

It is an installable PWA. Chrome, Edge and Brave show an install icon in the
address bar (or use the **Install app** button in the controls); Android Chrome
offers "Install app" in the menu; iOS Safari uses Share -> Add to Home Screen.

Installed, it opens full-screen with its own icon and **works offline** — the
service worker precaches the shell and caches poster art as you browse. Bump
`CACHE` in `sw.js` whenever `index.html` changes so clients pick up the update.

Files: `manifest.webmanifest`, `sw.js`, and `assets/icon-*.png` (192, 512 and a
maskable 512 whose art sits inside the safe zone), all generated from the
official A glyph.

## Credits and rights

Fan project. Not affiliated with, endorsed by, or connected to Marvel Studios,
The Walt Disney Company, Sony Pictures or 20th Century Studios. All film and
series titles and logos belong to their respective owners and are used here for
identification in a non-commercial fan guide.

`assets/doomsday-logo.png` is the Marvel Studios *Avengers: Doomsday* wordmark as
published on Wikimedia Commons. `assets/doomsday-a.png` is the "A" glyph cropped
from it. Release dates for unreleased titles are as publicly announced and may
change; nothing here is a leak, and nothing rumoured is presented as confirmed.

## Poster art

Each entry shows its poster, hotlinked from the Wikipedia article for that
title (`upload.wikimedia.org`). The URLs live in the `POSTERS` map in
`index.html` and `_posters.json`; each was verified to serve a real image at
build time. A title whose image ever fails to load falls back to a generated
card carrying its initials, name and year, so no row is ever left blank.

Wikipedia has no portrait poster for a television series — its infobox image is
the wordmark. Those 43 entries get a composed one-sheet instead: the official
logo, screen-blended onto a field themed to that title, filling the tile rather
than letterboxing inside it. The remaining 78 use their real poster art.

Agents of S.H.I.E.L.D. is the only live-action Marvel show deliberately left
untracked — 136 episodes is too large a bet on a payoff that may never come. It
is described in the exclusions section rather than listed.
