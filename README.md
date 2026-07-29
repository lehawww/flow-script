# FlowScript

Notate rap flow on a beat ruler. Place lyrics one syllable per rhythmic position, then annotate
stress, rhyme and phrase structure on top of that grid — and export the result as a high-resolution
image.

Runs entirely in your browser. No account, no server, no network calls: your songs are files on your
own machine and never leave it.

**[Try it →](https://lehawww.github.io/flow-script/)**

## What it does

Three layers of annotation over a bar-and-beat grid:

- **Stress** — a large circle for a stressed syllable, a small one for unstressed, centred on the
  notch it lands on.
- **Rhyme** — the circle's fill color, from an editable 16-color palette. Matching circles can be
  joined by a thick tie along the baseline, which may run across a bar line.
- **Phrase structure** — a background highlight over a range of subdivisions, which may span bars.

The ruler itself is flexible: any number of beats per bar, and **division set per beat**, so a bar
can mix triplets against 16ths. Notch height and stroke weight follow metric depth, so the "&" of a
beat reads taller and heavier than the "e" and the "a".

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

To build a static copy you can host anywhere:

```bash
npm run build     # -> dist/
```

`dist/` uses relative paths, so it works from any host or subpath.

## The workflow

Work in passes — that is what the three modes are for. Every button has a keyboard equivalent; press
**Keys ?** in the toolbar for the full list. The whole app is built around sweeping a verse one
concern at a time rather than fiddling with one syllable at a time.

**1. Text** (`Ctrl/⌘ 1`) — type one syllable per position. `Space` commits and advances, `Enter`
drops to the next bar, `Backspace` on an empty slot steps back. Not every position needs a syllable;
just skip past it. Drag any syllable to nudge it off centre when two collide.

**2. Annotate** (`Ctrl/⌘ 2`) — `A` marks a stressed syllable, `S` unstressed, `D` clears; each
advances, so you can sweep a bar in one run. Hold Shift to set without advancing. Number keys apply
rhyme colors (`1`–`9`, `0`, then Shift+`1`–`5`; backtick resets to grey). `Q` connects a circle to
the next one with a rhyme tie.

**3. Phrase** (`Ctrl/⌘ 3`) — drag to lay a background highlight. It selects at the resolution the
beat is divided into, so with 16ths a phrase can run from the "e" of one beat to the "&" of another.
`1`–`8` pick the color, `0` is an eraser, click a highlight and press Delete to remove it.

## The ruler

Configurable in **Song settings**:

- Beats per bar (default 4), and the number the first bar is labelled with (may be 0).
- **Division per beat** — pick one with the toolbar's **Divide beat** buttons, then `→ bar` or
  `→ all` to spread it. 1, 2, 3, 4, 6 and 8 are supported.
- Caption line, top ruler (beat numbers or a 0–15 subdivision index), and lyric font. The word
  "beat" in front of the top ruler can be switched off.
- **Beat vertical padding** — the gap between bar rows. 0 puts them flush.
- **Lyric size** and **beat width**. Size sets how big the syllables print; beat width sets how much
  horizontal room each one gets. Turning the text up without widening the beat will run long
  syllables into their neighbours, since a 16th only owns a quarter of a beat.

Bars never wrap to the window — the view scrolls sideways instead, so what you see on screen is
exactly what gets exported.

## Colors

Both palettes are editable: press **Colors** in the toolbar. 16 rhyme colors and 8 phrase colors,
each with a picker and a hex field.

Colors are stored **inside the song file**, so a song always reopens and exports with the colors it
was made with. Because the document references colors by index, editing a swatch re-tints everything
already using it — the quick way to recolor a whole verse. You can also pin a preferred scheme as
the default for new songs; that preference is per-browser and never travels with a file.

## Files and export

One song is one `.flowscript.json` file. **Save** / **Open** use the browser's file picker; in
Chrome and Edge, Save writes back to the same file in place. Loading repairs partial or older files
rather than refusing them.

**Export PNG** writes the score at 1×–8× (3× is a good default for print), **SVG** exports vectors,
and **Copy** puts a PNG on the clipboard. Exports contain only the artwork — the cursor, hit targets
and selection outlines are stripped — and are independent of the zoom slider, so you can zoom out to
see a long verse and still get a full-resolution image.

## Hosting it

It is a static site with no backend, so anywhere that serves files will do.

**GitHub Pages** — the included workflow at `.github/workflows/pages.yml` builds and deploys on
every push to `main`, publishing to <https://lehawww.github.io/flow-script/>. Enable it once under
*Settings → Pages → Source: GitHub Actions*. Serving over HTTPS also means Save-in-place works,
which it cannot do from a local file.

**Any static host** — build and upload `dist/`.

**A single file, no host at all:**

```bash
npm run build:standalone
```

This inlines the script and stylesheet into one self-contained `standalone/FlowScript.html` that a
non-technical user can double-click. Two things degrade when a page is opened as a local file,
because browsers restrict what `file://` pages may do: Save writes a new copy to Downloads instead
of overwriting in place, and the remembered default palette may not persist. Colors saved inside a
song file are unaffected.

## Browser support

Built for current Chrome and Edge, which support the File System Access API and so can save back to
the same file. Firefox and Safari work too, but Save falls back to downloading a copy.

## Development

```bash
npm run typecheck
npm run build
```

There is no test runner. With the dev server running, open
<http://localhost:5173/selftest.html> for a self-test page covering the file format, the repair path
for damaged files, and the layout maths. Add a case there when you touch `src/model.ts` or
`src/layout.ts`.

[CLAUDE.md](CLAUDE.md) documents the architecture and the invariants worth knowing before changing
the geometry.

## License

[MIT](LICENSE).
