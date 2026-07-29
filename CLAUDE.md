# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser tool for notating rap flow on a beat ruler. A user writes a song's lyrics one syllable
per rhythmic position and annotates three things on top of that grid:

- **Stress** — a large circle (stressed) or small circle (unstressed) centred on a notch.
- **Rhyme** — the circle's fill color, from a 16-color user-editable palette; matching circles can
  be joined by a thick connector line along the baseline.
- **Phrase structure** — a background highlight covering a range of subdivisions, which may span
  bars.

It runs entirely client-side. No backend, no accounts, no network calls — songs are local files and
never leave the machine. That is a privacy guarantee, not an implementation detail: do not introduce
analytics, remote fonts, CDN assets or any other network dependency.

The repo is public and deploys to GitHub Pages from `.github/workflows/pages.yml`. Keep sample data
and test fixtures synthetic — no real song lyrics in the codebase.

## Commands

```bash
npm install
npm run dev              # Vite dev server on http://localhost:5173
npm run build            # tsc -b && vite build -> dist/
npm run build:standalone # dist/ folded into one file -> "standalone/FlowScript.html"
npm run typecheck        # tsc -b, no emit
npm run preview          # serve the production build
```

`build:standalone` exists because the normal build emits `<script type="module" crossorigin src=…>`,
and a module script with a `src` is a cross-origin fetch — opened from `file://` the page's origin is
`null`, the fetch is blocked, and the app never boots. `scripts/build-standalone.mjs` inlines the
script and stylesheet so there is no subresource left to block, which is what makes the
double-click-to-open handoff work. It replaces via replacer *functions*, never strings: bundles
contain `$&`/`$1`, which `String.replace` would expand and silently re-inject the tag being
replaced. It fails loudly if any `assets/` reference survives.

There is no test runner. Logic that a save/load cycle depends on is covered by a self-test page:
run `npm run dev` and open <http://localhost:5173/selftest.html>. It asserts document round-tripping
through `coerceSong`, repair of damaged files, the notch-level tables, and layout invariants. Add a
`check(...)` there when you touch `model.ts` or `layout.ts` — it is the closest thing to a unit
suite and it runs in a second.

`npm audit` reports esbuild advisories inherited from Vite 5. They affect the dev server only, and
Vite 6+ drops support for Node 21 which is what this machine runs — leave the pin alone unless Node
is upgraded.

## Architecture

The whole app is one SVG plus a keyboard-driven cursor over it. Four files carry the design; the
rest is chrome.

### `src/model.ts` — the document

A `Song` is bars → beats → subdivisions. The addressing vocabulary is used everywhere:

- `bar` indexes `song.bars`; the displayed label is `song.startBar + bar` (may start at 0).
- `beat` is `0 .. beatsPerBar-1`.
- `sub` indexes a beat's subdivisions, `0 .. bar.divisions[beat]-1`.

A `(bar, beat, sub)` triple is a **slot** (as a highlight endpoint, a `GridPos`) — phrase highlights
select at subdivision resolution, not beat resolution, so `comparePos` / `normalizeRange` in
`model.ts` are the only correct way to order or compare two positions. Slots are stored sparsely in
`Bar.slots`, keyed
`"beat:sub"` — most positions in a real song are empty, and `isEmptySlot` in `App.tsx` prunes a slot
back out of the map when its last annotation is removed. Anything that walks slots in reading order
(cursor movement, rhyme ties) goes through `allSlotRefs`.

**Division is per beat, not per bar.** `bar.divisions` has one entry per beat, so a bar can mix
triplets and 16ths. `NOTCH_LEVELS` maps each division to the visual weight of its subdivisions:
level 0 is the beat (tallest, thickest), rising numbers are shorter and thinner. This table is the
spec — `4: [0,2,1,2]` is what makes the "&" of a 16th-note beat taller than the "e" and "a".

`coerceSong` is the trust boundary for anything loaded from disk. It repairs rather than rejects:
out-of-range slots are dropped, missing division arrays are filled from `defaultDivision`,
highlights are clamped to the bars that exist. Every field a future version adds must be handled
here or loading an older file will silently drop it.

### `src/layout.ts` — geometry

`computeLayout(song, zoom)` is pure and is the single source of truth for positions. The renderer,
hit-testing and export all read from it, so on-screen and exported layout cannot drift apart.

**Bars never wrap.** A bar is always one row of `beatsPerBar * pxPerBeat`; the viewport scrolls
horizontally instead. This is deliberate — what the user sees must equal what gets exported.

`BASE` holds fixed metrics, but three of them are overridden from the document at the top of
`computeLayout`: `textSize` from `song.lyricSize`, `pxPerBeat` from `song.beatWidth`, and `rowGap`
from `song.rowGap`. All three are document settings, not view state — unlike zoom, they change the
exported artwork, so they must be applied before anything derived (`rowPitch`, row tops) is
computed. The row's `belowBaseline` grows with the lyric size so taller text cannot collide with the
next bar; the horizontal equivalent is the user's job via beat width, since only they know how long
their syllables are.

**Stroke weight carries the hierarchy.** `notchW` is `[1.9, 1.45, 1, 0.8]` and must stay *strictly*
descending — two levels at the same weight make the beat and the "&" read alike, which is the whole
point of the table. `baselineW` (2.7) sits deliberately above every one of them: the measure line is
the spine of the row and must out-weigh each tick on it.

The floor in `scaleMetrics` is `0.5`, not `1`. A 1px floor clamps the two lightest levels to the
same weight at 100% zoom and silently flattens the ramp — the values render as authored only because
the floor sits below all of them. Raise it and the hierarchy quietly disappears at the thin end.

All three invariants are asserted in the self-test, so a weight change that breaks one fails there
rather than in review.

No notch is drawn at `row.x1`: that position is beat 1 of the next bar, and notching it would double
the downbeat. The baseline still runs the full width.

The measure line starts at `row.lineX0`, not `row.x0`. Notches are centred on their x, so a line
beginning at `x0` leaves the left half of the beat-1 stroke hanging past its end — visible as a
ragged corner. `lineX0` backs off by `notchW[0] / 2` so the two meet flush. Anything else that wants
the bar's left edge (highlights, tie segments) still uses `x0`.

`labelSize` deliberately equals `rulerSize`: the bar numbers down the side and the beat numbers
along the top are one labelling system, and the bar number is not bolded.

`row.labelY` centres the bar number on the **beat notch's vertical run** (`y - notchH[0] / 2`), not
on the row block. It must not be derived from `top`/`bottom`, which move with the lyric size — the
number would then drift away from the downbeat it labels.

The SVG is rendered 1:1 with its viewBox (zoom changes layout units, it does not CSS-scale the
element), which is why `Score.tsx` can convert client coordinates to user space with a plain
translation rather than the screen CTM.

### `src/components/Score.tsx` — the surface

One `<svg>` that is both the editing surface and the exported artwork. Two rules keep those
compatible, and breaking either silently corrupts exports:

1. **Every visual property is a presentation attribute, never a CSS class.** A serialized clone gets
   no stylesheet from the host page.
2. **Anything editing-only carries `data-editor-only`** — hit targets, cursor ring, selection
   outline, drag preview. `exportImage.ts` strips those before serializing.

No `foreignObject`: it does not survive rasterisation. That is why text editing uses an HTML
`<input>` positioned over the SVG in `App.tsx` rather than an editable element inside it.

Drag state lives in a **ref**, not React state. pointerdown/move/up can all arrive before a
re-render, so a handler closing over state reads stale or null values. Pointer capture also pins
events to the element the drag started on, so the bar under the pointer is derived from the
coordinate (`barAtY`), not the event target — that is what lets a phrase highlight span bars.

### `src/App.tsx` — cursor, modes, keys

Owns the cursor, the mode, and every binding. Three modes, because the fast workflow for volume work
is to sweep the whole verse in one pass per concern:

- **Text** — type syllables, Space advances. Keys route through the overlay `<input>`.
- **Annotate** — `A`/`S`/`D` set large/small/no circle and advance; number keys apply rhyme colors;
  `Q` toggles a rhyme tie.
- **Phrase** — drag across subdivisions to highlight.

Space is matched on `e.code === 'Space'` as well as `e.key === ' '` because some input paths deliver
only the former. The global handler ignores events whose target is an input, so panel fields keep
working.

Mutations go through `mutateSlot`, which drafts a copy, applies the change, and prunes the slot if
it ends up empty. History (`useSong`) is plain snapshots — the document is small — with a `mergeKey`
so a text drag or a caption edit collapses into one undo step instead of one per event.

Re-dividing a beat keeps annotations whose position survives exactly: a slot at `sub/oldDiv` maps to
`sub * newDiv / oldDiv`, and is dropped if that is not a whole number. An 8th note survives a
4 → 8 change; a 16th does not survive 4 → 3.

### `src/io/`

`persist.ts` — one `.flowscript.json` file per song. Uses the File System Access API where available
(real in-place Save) and falls back to download + file-input. `exportImage.ts` — clone, strip
editor-only nodes, add a white background, then either hand back SVG source or rasterise through an
`<img>` into a canvas at an arbitrary scale for a high-DPI PNG.

**Export never reads the on-screen SVG.** Zoom changes layout *units* rather than CSS-scaling the
element, so serializing the live node bakes the current zoom into the file — a 50% view produced a
half-size, blurry PNG, and the sub-pixel stroke floors flattened the notch ramp on top of that.
`withExportSVG` in `App.tsx` renders the same `<Score>` into a detached root at zoom 1 via
`flushSync`, hands that node to the export, then unmounts on a `setTimeout` (unmounting inline would
land inside React's commit phase). Reusing the component rather than re-deriving SVG is what keeps
the export from drifting from the editor. `exportScale` controls resolution and nothing else: at 1×
the PNG matches the document's own pixel size, at 8× it is exactly 8 times that, whatever the zoom.

## Conventions

Colors are referenced by **index**, not hex, everywhere in the document, so editing a swatch
re-tints every circle already using it instead of orphaning it. `src/palette.ts` holds only the
*defaults*; the live values are `song.palette` (16) and `song.highlightPalette` (8), which travel
with the file so exports and reopened songs always match.

That makes palette length load-bearing: `coercePalette` pins both arrays to `PALETTE_SIZE` /
`HIGHLIGHT_SIZE` and fills any missing or malformed entry from the defaults, so a color index can
never dangle. Never read `DEFAULT_PALETTE` to render — go through `rhymeFill` / `phraseFill` with
the song's array, or a custom palette silently renders as the stock pastels.

A team's preferred scheme is seeded into new songs from localStorage (`loadStoredPalettes`), which
is the *only* palette state outside the document; it never travels with a file.

`COLOR_KEY_HINTS` is both the help text and the keyboard mapping (its index is the palette index),
so the two cannot drift.

`styles.css` styles editor chrome only. If a rule would affect how the score looks, it belongs in
`Score.tsx` as an attribute instead.
