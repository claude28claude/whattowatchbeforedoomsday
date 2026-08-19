# The Doomsday Protocol — project notes

Builder-facing companion to `README.md`. The README says what the site *is*;
this says how it works, why it is built this way, and where the traps are.

**Live:** https://claude28claude.github.io/whattowatchbeforedoomsday/
**Repo:** `claude28claude/whattowatchbeforedoomsday` (public, `main`, Pages from root)
**Local:** port 8127, registered in the workspace `.claude/launch.json`
**Started:** 8 August 2026 · own git repo, ignored by the workspace `.gitignore`

---

## 1. File layout

It began as one file and grew to 205KB / 3,106 lines, at which point every edit
meant loading markup, styling, data and logic together. Split by concern:

| file | ~size | contents |
|---|---|---|
| `index.html` | 55 KB | markup and prose only |
| `styles.css` | 44 KB | all styling |
| `data.js` | 71 KB | `PARTS`, `EXTENSIONS`, `POSTERS`, `COMPOSED` |
| `app.js` | 35 KB | render, state, countdowns, PWA wiring |
| `sw.js` | 3 KB | service worker |
| `manifest.webmanifest` | 1 KB | PWA manifest |
| `assets/` | — | glyph, wordmark, four icons |
| `_posters.json` | 12 KB | build artefact; source of truth for regenerating `POSTERS` |

**`data.js` declares globals and must load before `app.js`.** `app.js` is a single
IIFE that reads them. No bundler, no transpile, no build step — they are plain
static files served as-is.

**Open only the file you need.** That is the entire point of the split.

---

## 2. Data model

Every entry in `PARTS` (core) and `EXTENSIONS` (optional):

```js
{ id, t, y, type, run, eps, tier, tl, tlt, dir, where, pc, soon,
  why, intro, note, stop }
```

- **`id`** — stable string key. **Progress is saved against this, never against
  the row number** (`localStorage` key `doomsdayProtocol.v2`). Running numbers are
  computed at load. This is why adding 27 entries mid-life never scrambled anyone's
  ticks. **Do not rename an id.**
- **`tier`** — `essential` | `recommended` | `optional`. Drives both the badge and
  the `EXPERIENCE` set.
- **`tl`** — numeric timeline sort key. Values ≥ 9000 mean "off-calendar": 9000s
  outside time (Loki), 9100s multiverse, 9200s Earth-10005 (Fox), 9300s Earth-828,
  9500s+ other studios. `tlt` overrides the displayed label.
- **`type`** — `film` | `series` | `special` | `short`. Note the **Films only**
  filter deliberately also keeps `special` entries whose `where` is `Cinemas`,
  so Endgame Encore is not dropped from a film filter.
- **`soon: true`** — not released; shows the red tag and suppresses the
  post-credits count.

Counts as built: **94 core in 6 parts**, **27 extension in 5 blocks**, 121 posters.

---

## 3. Key decisions, and why

**Two progress bars.** One bar over all 94 made Blade weigh the same as Endgame.
The top bar tracks `EXPERIENCE` — the 55 entries tiered essential or recommended.
Checked against Disney+'s own official 15-title Doomsday watchlist: **all fifteen
fall inside that set**, so the tiering is defensible against the studio's own view.

**The poster is the checkbox.** No separate control. `posterHTML` emits a
`<button class="cb e-poster" role="checkbox">`; a `.ptick` badge drops in and the
art desaturates when watched.

**Never re-render the list on a tick.** `toggle()` does a surgical `paintEntry` +
`refreshCounters` + `updateStats`. A full `render()` only runs on filter/order/
search change, and on tick when the `todo` filter is active. This took a tick from
**32ms → 0.3ms**, and it is also what keeps expanded panels open. Open rows live in
`openIds` and are restored by `entryHTML`. Events are delegated once per container.

**The mark is baked, not live.** The emblem is ~3,900 SVG paths inside blur
filters. Rendered live with an animation on top, every frame re-rasterised the lot
— that was the flicker seen on a slower device. It is now serialised once to a
data URI on `#markLayer`, and `#emblemWrap` gets `display:none`. **`visibility:hidden`
is not enough** — it leaves the paths in the render tree.

**Content policy.** Agents of S.H.I.E.L.D. is the only live-action Marvel show
deliberately *described but not listed* — 136 episodes is too large a bet on a
payoff that may never come. Everything else from that era is in Extension D,
tagged Optional, with an honest line on whether it is worth the time.

---

## 4. The logo

Real Marvel art, not a recreation. Found via **Wikimedia Commons MediaSearch HTML**
(`commons.wikimedia.org/w/index.php?search=…&title=Special:MediaSearch&type=image`,
then grep for `upload.wikimedia.org`). The Commons API, TMDB's site and Fandom are
all blocked or time out from here; the `upload.wikimedia.org` and `image.tmdb.org`
CDNs *are* reachable with a browser UA.

`assets/doomsday-logo.png` is the official wordmark (1000×396 RGBA).
`assets/doomsday-a.png` is the "A" cropped from it with Pillow (231×330, upscaled
5× to 1155×1650, alpha preserved).

**Geometry — do not change one number without recomputing the rest.** The glyph's
own arc was solved by three-point circle fit: centre **(772.4, 993.3)**, outer
radius **773**, band **121** glyph-px. In the 600×600 viewBox that becomes:

```
image  x=95.16  y=36.58  w=306.31  h=437.58
ring   r=188.96 stroke-width=32.09
inner  r=172.91
```

Those make the drawn ring merge seamlessly with the arc already inside the glyph.

**Mask trick:** the glyph is black-on-transparent, so dropping it into a luminance
`<mask>` over a white disc gives "disc minus A" for free. Running it through
`filter:#toWhite` (feColorMatrix forcing RGB=1, keeping alpha) gives "the A itself"
for the metal fill.

---

## 5. Posters

All 121 resolved from each title's Wikipedia article and **verified to serve a real
image before shipping** — not merely that the lookup returned something.

**Wikipedia has no portrait poster for a TV series.** Its infobox image is the
wordmark; no season article carries one either. So 43 entries (every Disney+ and
Netflix show) get a **composed one-sheet**: the official logo, `mix-blend-mode:
screen` so its black plate drops out, on a field themed per title via `--pt`
(`COMPOSED` map). These fill the tile rather than letterboxing.

The 78 real posters use `object-fit: cover`. Zero tiles have dead space — measured.

Every row also has a generated fallback card (initials, name, year) sitting
underneath; a failed image simply uncovers it.

To regenerate: `_posters.json` is the source. Fetch via
`en.wikipedia.org/api/rest_v1/page/summary/<Title>` → `originalimage.source`
(fair-use posters have **no** generated thumbnails), pace ~1.1s to avoid the rate
limit, then strip the `?utm_*` query.

---

## 6. Design language

**Palette** — green throughout (`--acc:#8ede4d` on `--bg:#030806`), matching the
logo. The old brass variables were renamed `--acc / --acc-lt / --acc-glow`;
**do not reintroduce gold.** Slate-blue survives as the metal secondary.

**Radius scale** — `--r-xs 10 / --r-sm 14 / --r-md 18 / --r-lg 24`, sized by
container weight. This replaced eight ad-hoc values.

**Glass** — `.glass` (blur + gradient + inset hairline) goes on ~13 *large*
containers only. Inner elements set `backdrop-filter:none` explicitly. Blur on all
257 elements was the dominant compositing cost. **Do not put `.glass` on entries.**

**Liquid glass** — `.lglass` on the part lists: near-clear face (0.8% fill), a
rim-only pseudo-element that refracts the backdrop, a specular sheen, and stacked
inset rims for thickness. Type carries its own shadow because there is almost no
panel behind it.

**Wordmark** — "The Doomsday" in serif; **PROTOCOL** as a wide-tracked mono
classification line with rules either side and letters easing in. Knocked out
(`-webkit-text-stroke` + 14% fill) so the mark reads through the letterforms.

**Motes** — two seeded tiles of small dark specks, a few ringed in faint green,
drifting on one composited layer. Deliberately almost invisible.

---

## 7. Service worker rules

- **Bump `CACHE` in `sw.js` on every content change.** Currently `v11`.
- Navigations: network-first, cached `index.html` as the offline fallback.
- Same-origin **`.js` / `.css`: network-first**. They were cache-first, which meant
  a forgotten `CACHE` bump could pair a fresh `index.html` with a stale `app.js`.
  Network-first removes that class of bug entirely.
- Static assets (icons, glyph): cache-first — they never change in place.
- Wikipedia posters: separate `doomsday-posters-v1` cache, stale-while-revalidate.

**Trap:** while testing locally, a stale service worker *will* serve old CSS/JS and
you will chase phantom bugs. Unregister it and `caches.delete()` before trusting
what you see. This cost real time once.

---

## 8. Accessibility

- Every card heading is `<h3 class="card-h">`. They were `<h4>` under `<h2>`,
  skipping a level six times over. Document now has **zero heading skips**.
- Poster-checkbox is a real `<button>` with `role="checkbox"`, `aria-checked` and a
  per-title label. **Trap:** because it is a real button, Space/Enter fire the
  native click *as well as* any delegated keydown — the keydown handler must
  `return` early on `.cb` or every keypress toggles twice and cancels out.
- `.e-body` is focusable with `role="button"` and `aria-expanded`.
- Five `aria-live` regions; skip link; reduced-motion covered.
- Contrast measured with alpha blended: everything passes AA **except** the version
  stamp (~1.9:1), dimmed at the user's explicit request.

---

## 9. Deploying

```bash
git add -A && git commit -m "…"
git push origin main
```

Pages rebuilds in roughly 1–2 minutes. Poll:

```bash
gh api /repos/claude28claude/whattowatchbeforedoomsday/pages --jq '.status'
```

**`gh` is not on PATH** in this workspace's shells — call it by full path:
`C:\Users\amanc\AppData\Local\Programs\GitHubCLI\bin\gh.exe`

Pages caches hard; append a query string when verifying a fresh deploy or you will
measure the old file.

---

## 10. Known limitations

- **Version stamp contrast** is below AA by request.
- **Posters are hotlinked** to `upload.wikimedia.org`. Light on the repo and avoids
  redistributing 121 images, but it depends on Wikipedia staying up and on those
  file paths not moving.
- **The site publicly hosts Marvel's wordmark.** Non-commercial fan guide with a
  disclaimer in the footer and README, but it is real studio art on a public URL.
- **Unreleased dates** (VisionQuest, Endgame Encore, everything under After
  Doomsday) are as announced and will move. Anything reported-but-not-official is
  marked as such — grey dots on the timeline, brass for studio-confirmed.
- **Cast list** is only what Marvel has announced. No leaks, no rumours.
- **The composed one-sheets are designed cards, not character art.** If real
  character posters are ever wanted for those 43, they need image files dropped
  into `assets/` and wiring in place of the composed treatment.

---

## 11. Working preferences that shaped this

- Verify through behaviour and plain English, not by describing code.
- Promote things from prose into the tracked list rather than describing them in a
  card — the tier system already handles "optional".
- Never present a rumour as announced; never present a reported date as confirmed.
- When a factual claim is wrong, say so with the source rather than changing the
  site to match — the Fantastic Four title was checked three times and left as
  *The Fantastic Four: First Steps*, which is correct.
