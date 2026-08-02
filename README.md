# FlowScript

**A tool for notating rap flow on a beat ruler.** Place lyrics one syllable per metric position,
then annotate stress, rhyme and phrase structure over that grid — and export the result as a
publication-quality image.

### **[▶ Open FlowScript](https://lehawww.github.io/flow-script/)**

Created by **Leah Amarosa, PhD** (Music Theory), for music theorists documenting flow in
transcription and analysis.

Nothing to install and nothing to sign up for. It runs entirely in your browser, and your work stays
on your own computer.

![A four-bar verse notated in FlowScript: syllables placed on a 16th-note grid, large and small
circles marking stressed and unstressed syllables, colored circles joined by ties showing rhyme,
four syllables striped in a second color where two rhymes overlap, and four phrase bands behind the
score, two of which carry across a bar line.](docs/example.png)

*An exported figure. Circle size shows stress, circle color shows rhyme — tied pairs are
multisyllabic rhymes, and a striped circle is a syllable two rhymes share — while the background
bands mark phrase structure.*

---

# For users

## What it does

FlowScript gives you a bar-and-beat grid and three layers of annotation over it:

**Syllable placement.** Type one syllable per metric position. Positions you don't use stay empty,
so rests and held syllables read correctly.

**Stress.** A large circle marks a stressed syllable, a small circle an unstressed one, centred on
the notch it lands on. Positions can also carry no circle at all.

**Rhyme.** The circle's fill color, from an editable 16-color palette. Matching circles can be
joined by a thick tie along the baseline, which may run across a bar line — useful for
multisyllabic rhymes that straddle the barline. A circle can carry a **second** color as diagonal
stripes, for a syllable two rhymes share: in "drop it in the pocket", *drop* and *it* belong both to
the earlier rhyme and to the new multi built on *pock-et*.

**Phrase structure.** A background highlight over a range of positions. Highlights select at
subdivision resolution and may span bars, so a phrase can begin on the "e" of one beat and end on
the "&" of another.

The ruler itself is flexible. Any number of beats per bar, and **division is set per beat**, so a
single bar can put a triplet against surrounding 16ths. A beat can also be **split at its half**,
with each half divided on its own — a triplet across the first 8th and straight 16ths across the
second, and the three other pairings. Notch height and stroke weight follow metric depth, so the "&"
of a beat reads taller and heavier than the "e" and the "a" — the hierarchy is visible at a glance
rather than something you have to count out.

## Getting started

Open **<https://lehawww.github.io/flow-script/>**. That's it — there is no installation, account, or
setup step. You'll get an empty four-bar ruler ready to type into.

![The FlowScript editor in Annotate mode: file, export and zoom controls along the top, then the
mode buttons with the stress controls, the 16-color Rhyme palette and the striped second-color row
beneath them, the annotated four-bar score filling the rest of the window, and the keyboard hints
along the bottom.](docs/editor.png)

The toolbar holds file and export actions along the top, and the current mode's tools below. Press
**Keys ?** at any time for the complete keyboard reference.

## How you work: three passes

FlowScript is built for annotating a whole verse one concern at a time, rather than finishing one
syllable completely before moving to the next. Each mode is a pass over the material.

### 1. Text — lay in the syllables

Press `Ctrl/⌘ 1`. Type a syllable, then:

| Key | Does |
|---|---|
| `Space` | commit and move to the next position |
| `Enter` | commit and drop to the next bar |
| `Backspace` on an empty slot | step back |
| `←` `→` | move a position at a time |
| `↑` `↓` | same position, previous/next bar |
| `Home` / `End` | first/last position in the bar |

Skip past any position that has no syllable. If two syllables end up crowding each other, drag
either one to nudge it off centre; the nudge is saved with the song.

### 2. Annotate — stress and rhyme

Press `Ctrl/⌘ 2`.

| Key | Does |
|---|---|
| `A` | stressed (large circle), then advance |
| `S` | unstressed (small circle), then advance |
| `D` | clear the circle, then advance |
| `Shift` + `A`/`S`/`D` | the same, without advancing |
| `1`–`9`, `0`, then `Shift`+`1`–`5` | apply rhyme colors 2–16 |
| `` ` `` | reset to the default grey |
| `Alt` + any color key | add that color as a *second* rhyme; again removes it |
| `Q` | tie this circle to the next one |
| `Backspace` | clear everything at this position |

Because `A`, `S` and `D` advance on their own, you can sweep a full bar of stress marks in one run
of keystrokes without reaching for the mouse.

Applying a color to a position that has no circle gives it a large one, on the assumption that a
syllable you're marking as rhyming is a syllable that's there.

The swatch rows always mark the colors of the syllable at the cursor, so moving along a line shows
you what each circle is already wearing rather than what you last pressed.

### Two rhymes on one syllable

Rhymes overlap: the syllable that ends one multi is often the syllable that starts the next. The
toolbar's **2nd** row — the striped swatches under **Rhyme** — puts a second color on the circle at
the cursor, drawn as diagonal stripes over the first. Picking the same color again takes it off, as
does the `⌫` at the end of that row; a plain color key sets one solid color again.

So in "drop it in the pocket", *drop* and *it* keep the earlier rhyme's color and pick up a stripe
of the new one, while *pock-* and *et* carry the same pair — the shared syllables are visible as
shared rather than reassigned to whichever rhyme you marked last.

Pick the stripe from the **dark** end of the palette — Indigo, Crimson, Forest and Plum, the four
before White. Two pastels striped together average out into a single muddy tint; a dark against a
pastel stays readable as two colors at the size a circle actually gets printed.

### 3. Phrase — structure

Press `Ctrl/⌘ 3`, then drag across the score to lay a highlight.

| Key | Does |
|---|---|
| `1`–`8` | choose the highlight color, or recolor the one you have selected |
| `0` | eraser — drag over highlights to remove them |
| `Delete` | remove the highlight you have selected |

Click a highlight to select it. Drags snap to the subdivision grid, so a highlight starts and ends
exactly where a syllable does.

The swatch strip marks the selected highlight's own color, so you can see what a band is without
guessing, and picking another color recolors it in place.

## Adding bars, undoing, zooming

New songs start with four bars. The **Bars** buttons in the toolbar add and remove them:

| Button | Does |
|---|---|
| **+ end** (or `Ctrl/⌘ Enter`) | add a bar at the end of the song |
| **+ here** | insert a bar before the one you're in |
| **duplicate** | copy the current bar, with its annotations, directly after it |
| **delete** | remove the current bar |

`Ctrl/⌘ Z` undoes and `Ctrl/⌘ Shift Z` redoes, throughout. Related edits collapse into one step, so
dragging a color picker or typing a caption undoes as a single action rather than character by
character.

The **Zoom** slider changes only how large the score appears while you work. It has no effect on the
document or on anything you export.

## Setting up the ruler

Open **Song settings** in the toolbar.

- **Caption** — verse number, song title, artist, year and time-stamp. These render as a heading
  above the score in exports, in the form *Verse 2, "Song Title," Artist (1994), 1:04*.
- **Beats per bar**, and the number the first bar is labelled with (which may be 0).
- **Default division** for new bars.
- **Beat width** — how much horizontal room each beat gets.
- **Beat vertical padding** — the gap between bar rows; 0 puts them flush.
- **Top ruler** — beat numbers, a 0–15 subdivision index, or none. The word "beat" in front of it
  can be switched off.
- **Lyric font** — sans, or serif italic in the style of published transcriptions.
- **Lyric size**.

**Setting division per beat:** in Text mode, select a position in that beat, then use the toolbar's
**Divide beat** buttons — 1, 2, 3, 4, 6 or 8. `→ bar` applies your choice to every beat in the
current bar, `→ all` to the whole song. The **Divide beat** and **Bars** rows belong to Text mode:
you lay the grid out while you are writing onto it, and Annotate and Phrase get their rows back for
the marks they are there to make.

**Splitting a beat at its half:** the **halves** buttons next to them — `3+2`, `2+3`, `3+4`, `4+3` —
divide the first half of the beat and the second half differently. `3+2` puts a triplet across the
first 8th and two 16ths across the second; `3+3` and `2+2` are not listed because they are already
the plain 6 and 4. The half of the beat keeps its own notch weight, so you can still see where the
"&" falls. Re-dividing keeps every syllable that still lands on a notch and drops the rest, so
moving a straight-16th beat to `3+2` keeps the downbeat, the "&" and the "a" and lets the "e" go.

A note on size and width: they work together. Turning the lyric size up without also widening the
beat will run long syllables into their neighbours, since a 16th only owns a quarter of a beat.

**Bars never wrap to the window.** The view scrolls sideways instead, so what you see on screen is
exactly what gets exported — no surprises between the editor and the finished figure.

## Colors

Press **Colors** in the toolbar to edit either palette: 16 rhyme colors and 8 phrase colors, each
with a color picker and a hex field.

The stock rhyme scheme is eleven pastels, then four dark colors, then white. If you replace the dark
ones, keep something dark in the scheme: two-color circles need a light and a dark to read as two
rhymes rather than one blended tint.

Colors are saved **inside the song file**, so a piece always reopens and exports with the colors it
was made with, and two analyses can use different schemes without interfering. Because positions
reference colors by index rather than by value, editing a swatch re-tints everything already using
it — which is the quick way to recolor a whole verse if a scheme isn't reading well.

If you settle on a scheme you like, **Save as default for new songs** keeps it for future work. That
preference lives in your browser and is not part of any file you share.

## Saving your work

One song is one `.flowscript.json` file on your computer.

**Save** / **Open** use your browser's normal file dialog. In Chrome and Edge, Save writes back to
the same file in place, the way a desktop application would. In Firefox and Safari, Save downloads a
fresh copy instead — the work is identical, you just manage the files yourself.

Opening a file repairs anything partial or out of date rather than refusing it, so songs made with
earlier versions keep working.

To share an editable song with a colleague, send them the `.flowscript.json` file; they open it with
**Open**.

## Exporting figures

- **Export PNG** at 1× to 8×. **3× is a good default for print**; 8× is generous for a large figure.
- **SVG** for a vector file you can scale losslessly or edit in Illustrator or Inkscape.
- **Copy** puts a PNG straight on your clipboard to paste into a document or slide.

Exports contain only the artwork — the cursor, selection outlines and editing handles are stripped.
They're also independent of the zoom slider, so you can zoom out to see a long verse whole and still
get a full-resolution image.

The figure at the top of this page is an unretouched 3× PNG export. Its source is in the repository
as [`docs/example.flowscript.json`](docs/example.flowscript.json) — open it with **Open** to see how
it was put together.

## Your work is private

FlowScript makes no network requests. There is no account, no server, no analytics, and no telemetry
of any kind. Songs are files on your own machine and are never uploaded anywhere. Once the page has
loaded you can disconnect from the internet entirely and keep working.

This matters for unpublished analysis and for material you don't hold the rights to redistribute.

## Working offline, or sharing the tool itself

If you'd rather not depend on the website — for teaching on an unreliable connection, or archiving a
copy alongside a paper — FlowScript can be built as a **single self-contained HTML file** that you
double-click to open. See [For developers](#for-developers) below, or ask whoever set this up for a
copy of `FlowScript.html`.

Two things behave differently in that offline copy, because browsers restrict what local files may
do: Save writes a new copy to your Downloads folder instead of overwriting in place, and the
remembered default palette may not persist between sessions. Colors saved inside a song file are
unaffected.

## Browser support

Best in current **Chrome or Edge**, which support saving back to the same file. Firefox and Safari
work fully otherwise; Save just downloads a copy each time.

---

# For developers

A React + TypeScript single-page app built with Vite. No backend, no runtime dependencies beyond
React, and no network calls at all.

## Running locally

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | typecheck, then build to `dist/` |
| `npm run build:standalone` | fold `dist/` into one file at `standalone/FlowScript.html` |
| `npm run typecheck` | `tsc -b`, no emit |
| `npm run preview` | serve the production build |

## Testing

There is no test runner. Logic that a save/load cycle depends on is covered by a **self-test page**:
run `npm run dev` and open <http://localhost:5173/selftest.html>. It asserts document round-tripping,
repair of damaged and older files, the notch-level tables, the layout invariants, and the palette
contrast that two-color circles depend on — and it runs in about a second.

Add a `check(...)` there whenever you touch `src/model.ts`, `src/layout.ts` or `src/palette.ts`.

## How it fits together

The whole score is one `<svg>` with a keyboard-driven cursor over it. Four files carry the design:

| File | Responsibility |
|---|---|
| `src/model.ts` | the document: bars → beats → subdivisions, plus `coerceSong`, the trust boundary for anything loaded from disk |
| `src/layout.ts` | pure geometry — the single source of truth for positions, shared by the renderer, hit-testing and export |
| `src/components/Score.tsx` | the SVG surface, which is both the editing UI and the exported artwork |
| `src/App.tsx` | cursor, modes and every keyboard binding |

Two invariants are easy to break and fail silently:

1. **Every visual property in `Score.tsx` is a presentation attribute, never a CSS class** — a
   serialized clone gets no stylesheet from the host page, so a class-styled element exports wrong.
2. **Anything that exists only for editing carries `data-editor-only`** so export can strip it.

**[CLAUDE.md](CLAUDE.md) is the real architecture document.** It explains the addressing vocabulary,
why bars never wrap, why the stroke-weight ramp must stay strictly descending, why export renders
offscreen at zoom 1, and the other decisions whose reasons aren't obvious from the code. Read it
before changing the geometry.

## Deploying

Pushing to `main` triggers `.github/workflows/pages.yml`, which builds and publishes to
<https://lehawww.github.io/flow-script/>. Pages is configured under *Settings → Pages → Source:
GitHub Actions*.

`vite.config.ts` sets `base: './'`, so the build uses relative asset paths and works from a project
subpath without further configuration.

For the offline single-file build, `npm run build:standalone` inlines the script and stylesheet so
there is no subresource left for a `file://` page to be blocked from fetching. The normal `dist/`
build will not open by double-click; that is the whole reason the script exists.

## A note on dependencies

`npm audit` reports esbuild advisories inherited from Vite 5. They affect the dev server only, not
anything shipped. Vite 6+ drops support for Node 21, so the pin is deliberate — leave it alone unless
the toolchain moves.

---

## License

[MIT](LICENSE) © 2026 Leah Amarosa.
