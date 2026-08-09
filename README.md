# What To Watch Before Doomsday

**The Doomsday Protocol** — a fan-made, deeply annotated Marvel watch order for
*Avengers: Doomsday* (18 December 2026).

**Live:** https://claude28claude.github.io/whattowatchbeforedoomsday/

## What it is

94 core entries across six parts, plus 14 optional extension entries. Every title
carries its runtime, director, streaming home, in-universe timeline placing,
post-credits count, first appearances, and a written answer to *why it is on the
list at all*.

- **Part I** — The Infinity Saga (24 films)
- **Part II** — The Street-Level Track (6 Netflix seasons)
- **Part III** — The Multiverse Saga (23)
- **Part IV** — The Older Universes (Blade, Ghost Rider, Raimi & Webb Spider-Man)
- **Part V** — The X-Men (the complete Fox catalogue, 17)
- **Part VI** — The Final Run (Phase 6)

Plus the Marvel One-Shots, Sony's Spider-Man Universe and the Spider-Verse films
as separately tracked extensions, an "After Doomsday" timeline of everything
announced past December 2026, and a second countdown to *Avengers: Secret Wars*.

## Features

- Release order and timeline order
- Live countdowns to Doomsday, Endgame Encore and Secret Wars
- Progress saved in the browser, per title — adding entries never scrambles it
- Save/load progress to a file to move between devices
- Filters, search, jump-to-part, mark-a-whole-part-watched
- A finish-by-date pace planner
- Keyboard accessible, screen-reader announced, print stylesheet

Single file, no build step, no dependencies, no tracking. Open `index.html`.

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
the wordmark. Those 30 entries get a composed one-sheet instead: the official
logo, screen-blended onto a field themed to that title, filling the tile rather
than letterboxing inside it. The remaining 78 use their real poster art.
