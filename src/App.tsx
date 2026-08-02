/**
 * Editor shell: owns the cursor, the mode, and every keyboard binding, and
 * translates them into mutations on the Song.
 *
 * The score is a single SVG sized in real export pixels (see layout.ts). Text
 * editing happens in an HTML <input> absolutely positioned over the slot being
 * edited — the SVG never contains foreignObject, which would not survive
 * rasterisation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import HelpPanel from './components/HelpPanel'
import PalettePanel from './components/PalettePanel'
import Score, { type Mode } from './components/Score'
import SettingsPanel from './components/SettingsPanel'
import Toolbar from './components/Toolbar'
import { computeLayout } from './layout'
import {
  allSlotRefs,
  beatSubdivisions,
  coerceSong,
  comparePos,
  getSlot,
  makeBar,
  makeId,
  newSong,
  normalizeRange,
  refIndex,
  slotKey,
  subAtFraction,
  subCount,
  type CircleKind,
  type Division,
  type GridPos,
  type Slot,
  type SlotRef,
  type Song,
  type SongHeader,
} from './model'
import {
  clearStoredPalettes,
  colorIndexForKey,
  COLOR_KEY_HINTS,
  DEFAULT_COLOR,
  DEFAULT_HIGHLIGHTS,
  loadStoredPalettes,
  storeDefaultPalettes,
  swatchLabel,
  type StoredPalettes,
} from './palette'
import { copyPNGToClipboard, exportPNG, exportSVG } from './io/exportImage'
import { FILE_EXT, openSong, saveSong, saveSongAs, suggestedName } from './io/persist'
import { useSong } from './useSong'

/** Inert handler for the offscreen export render, which is never interactive. */
const noop = () => {}

const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement

/** A slot is worth storing only while it carries something. */
function isEmptySlot(s: Slot): boolean {
  return (
    !s.text &&
    !s.circle &&
    s.color === undefined &&
    s.color2 === undefined &&
    !s.tie &&
    s.tdx === undefined &&
    s.tdy === undefined
  )
}

export default function App() {
  // A team's preferred colors seed new songs; each song then owns its own copy.
  const [storedPalettes, setStoredPalettes] = useState<StoredPalettes | null>(() =>
    loadStoredPalettes(),
  )
  const { song, update, reset, undo, redo, canUndo, canRedo, revision } = useSong(
    newSong(4, loadStoredPalettes() ?? undefined),
  )

  const [mode, setMode] = useState<Mode>('text')
  const [cursor, setCursor] = useState<SlotRef | null>({ bar: 0, beat: 0, sub: 0 })
  // The toolbar's swatch markers are derived from the slot under the cursor
  // (see shownColor / shownColor2 below), not held as "last color used" — the
  // strip reads as what this syllable is wearing rather than what you last
  // pressed, which is the question you have when you land on a circle.
  const [highlightColor, setHighlightColor] = useState<number | 'erase'>(0)
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [exportScale, setExportScale] = useState(3)
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [fileHandle, setFileHandle] = useState<Awaited<ReturnType<typeof saveSongAs>>>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [savedRevision, setSavedRevision] = useState(0)
  const dirty = revision !== savedRevision

  const svgRef = useRef<SVGSVGElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const layout = useMemo(() => computeLayout(song, zoom), [song, zoom])
  const refs = useMemo(() => allSlotRefs(song), [song])

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    window.setTimeout(() => setStatus((s) => (s === msg ? null : s)), 2600)
  }, [])

  /* ------------------------------------------------------------------ */
  /* Slot mutation                                                       */
  /* ------------------------------------------------------------------ */

  const mutateSlot = useCallback(
    (ref: SlotRef, fn: (slot: Slot) => void, mergeKey?: string) => {
      update((draft) => {
        const bar = draft.bars[ref.bar]
        if (!bar) return
        const key = slotKey(ref.beat, ref.sub)
        const slot: Slot = { ...(bar.slots[key] ?? {}) }
        fn(slot)
        if (isEmptySlot(slot)) delete bar.slots[key]
        else bar.slots[key] = slot
      }, mergeKey)
    },
    [update],
  )

  /* ------------------------------------------------------------------ */
  /* Cursor movement                                                     */
  /* ------------------------------------------------------------------ */

  const moveBy = useCallback(
    (delta: number) => {
      setCursor((cur) => {
        const i = refIndex(refs, cur)
        if (i < 0) return refs[0] ?? null
        const next = Math.min(refs.length - 1, Math.max(0, i + delta))
        return refs[next] ?? cur
      })
    },
    [refs],
  )

  const moveRow = useCallback(
    (delta: number) => {
      setCursor((cur) => {
        if (!cur) return refs[0] ?? null
        const bar = Math.min(song.bars.length - 1, Math.max(0, cur.bar + delta))
        if (bar === cur.bar) return cur
        const div = song.bars[bar].divisions[cur.beat] ?? song.defaultDivision
        return { bar, beat: cur.beat, sub: Math.min(cur.sub, subCount(div) - 1) }
      })
    },
    [refs, song],
  )

  const moveBarEdge = useCallback(
    (end: boolean) => {
      setCursor((cur) => {
        if (!cur) return refs[0] ?? null
        const inBar = refs.filter((r) => r.bar === cur.bar)
        return (end ? inBar[inBar.length - 1] : inBar[0]) ?? cur
      })
    },
    [refs],
  )

  // Keep the cursor visible without fighting the user's own scrolling.
  useEffect(() => {
    if (!cursor || !scrollRef.current) return
    const row = layout.bars[cursor.bar]
    const pos = row?.slots.find((s) => s.beat === cursor.beat && s.sub === cursor.sub)
    if (!row || !pos) return
    const el = scrollRef.current
    const pad = 60
    if (pos.x - pad < el.scrollLeft) el.scrollLeft = Math.max(0, pos.x - pad)
    else if (pos.x + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = pos.x + pad - el.clientWidth
    if (row.top - pad < el.scrollTop) el.scrollTop = Math.max(0, row.top - pad)
    else if (row.bottom + pad > el.scrollTop + el.clientHeight)
      el.scrollTop = row.bottom + pad - el.clientHeight
  }, [cursor, layout])

  /* ------------------------------------------------------------------ */
  /* Annotation actions                                                  */
  /* ------------------------------------------------------------------ */

  const setCircle = useCallback(
    (kind: CircleKind | null, advance: boolean) => {
      if (!cursor) return
      mutateSlot(cursor, (s) => {
        if (kind) s.circle = kind
        else {
          delete s.circle
          delete s.tie
        }
      })
      if (advance) moveBy(1)
    },
    [cursor, mutateSlot, moveBy],
  )

  const applyColor = useCallback(
    (index: number) => {
      if (!cursor) return
      mutateSlot(cursor, (s) => {
        // Color implies a syllable is there; give it a circle if it has none.
        if (!s.circle) s.circle = 'large'
        s.color = index
        // A plain color key means "this one rhyme", which is also the way back
        // to a solid circle from a two-color one.
        delete s.color2
      })
    },
    [cursor, mutateSlot],
  )

  /**
   * The second rhyme a syllable belongs to, drawn as stripes over the first.
   * The same key toggles it off, and a color already on the circle cannot be
   * striped against itself — that would just render as the solid circle again.
   */
  const applySecondColor = useCallback(
    (index: number) => {
      if (!cursor) return
      // Decided here rather than inside the draft: `update` runs its callback
      // inside a state updater, which React may invoke more than once.
      const current = getSlot(song, cursor)
      const off = current?.color2 === index || (current?.color ?? DEFAULT_COLOR) === index
      mutateSlot(cursor, (s) => {
        if (!s.circle) s.circle = 'large'
        if (off) delete s.color2
        else s.color2 = index
      })
    },
    [cursor, mutateSlot, song],
  )

  /** Back to a solid circle, leaving the first rhyme color alone. */
  const clearSecondColor = useCallback(() => {
    if (!cursor) return
    mutateSlot(cursor, (s) => {
      delete s.color2
    })
  }, [cursor, mutateSlot])

  const toggleTie = useCallback(() => {
    if (!cursor) return
    mutateSlot(cursor, (s) => {
      if (s.tie) delete s.tie
      else s.tie = true
    })
  }, [cursor, mutateSlot])

  const clearSlot = useCallback(() => {
    if (!cursor) return
    mutateSlot(cursor, (s) => {
      delete s.circle
      delete s.color
      delete s.color2
      delete s.tie
      delete s.text
      delete s.tdx
      delete s.tdy
    })
  }, [cursor, mutateSlot])

  const onMoveText = useCallback(
    (ref: SlotRef, tdx: number, tdy: number) => {
      mutateSlot(
        ref,
        (s) => {
          s.tdx = Math.round(tdx)
          s.tdy = Math.round(tdy)
        },
        `move:${ref.bar}:${ref.beat}:${ref.sub}`,
      )
    },
    [mutateSlot],
  )

  /* ------------------------------------------------------------------ */
  /* Division                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Re-divide a beat, keeping annotations whose position survives exactly.
   * A slot is mapped by *when* it falls in the beat, not by its index: it keeps
   * its annotation only if the new grid has a notch at the same instant, and is
   * dropped otherwise. An 8th survives 4 → 8 and a 16th does not survive 4 → 3,
   * and going to a "3+2" keeps whichever half still lines up.
   */
  const setDivision = useCallback(
    (div: Division, scope: 'beat' | 'bar' | 'all') => {
      if (!cursor) return
      const lastSub = subCount(div) - 1
      // Where the cursor ends up. Every scope re-divides the beat it is sitting
      // in, so it moves with its own syllable — landing on the notch at the same
      // instant, or on the last one when that instant is gone.
      const cursorAt = beatSubdivisions(
        song.bars[cursor.bar]?.divisions[cursor.beat] ?? song.defaultDivision,
      )[cursor.sub]?.at
      const cursorSub = cursorAt === undefined ? -1 : subAtFraction(div, cursorAt)
      update((draft) => {
        const apply = (barIndex: number, beat: number) => {
          const bar = draft.bars[barIndex]
          if (!bar) return
          const oldDiv = bar.divisions[beat] ?? draft.defaultDivision
          if (oldDiv === div) return
          const oldSubs = beatSubdivisions(oldDiv)
          bar.divisions[beat] = div
          const next: Record<string, Slot> = {}
          for (const [key, value] of Object.entries(bar.slots)) {
            const [b, s] = key.split(':').map(Number)
            if (b !== beat) {
              next[key] = value
              continue
            }
            const at = oldSubs[s]?.at
            const mapped = at === undefined ? -1 : subAtFraction(div, at)
            if (mapped >= 0) next[slotKey(beat, mapped)] = value
          }
          bar.slots = next

          // A highlight edge parked on a subdivision this beat no longer has
          // would render off the end of the beat; pull it back to the last one.
          draft.highlights.forEach((h) => {
            for (const edge of [h.start, h.end]) {
              if (edge.bar === barIndex && edge.beat === beat) {
                edge.sub = Math.min(edge.sub, lastSub)
              }
            }
          })
        }

        if (scope === 'beat') apply(cursor.bar, cursor.beat)
        else if (scope === 'bar') {
          for (let beat = 0; beat < draft.beatsPerBar; beat++) apply(cursor.bar, beat)
        } else {
          draft.defaultDivision = div
          draft.bars.forEach((_, barIndex) => {
            for (let beat = 0; beat < draft.beatsPerBar; beat++) apply(barIndex, beat)
          })
        }
      })
      setCursor((cur) =>
        cur ? { ...cur, sub: cursorSub >= 0 ? cursorSub : Math.min(cur.sub, lastSub) } : cur,
      )
    },
    [cursor, song, update],
  )

  /* ------------------------------------------------------------------ */
  /* Highlights                                                          */
  /* ------------------------------------------------------------------ */

  const createHighlight = useCallback(
    (a: GridPos, b: GridPos) => {
      if (highlightColor === 'erase') return
      const { start, end } = normalizeRange(a, b)
      update((draft) => {
        draft.highlights.push({ id: makeId('hl'), color: highlightColor, start, end })
      })
    },
    [highlightColor, update],
  )

  const eraseHighlights = useCallback(
    (a: GridPos, b: GridPos) => {
      const { start, end } = normalizeRange(a, b)
      update((draft) => {
        // Keep only highlights that do not overlap the erased range at all.
        draft.highlights = draft.highlights.filter((h) => {
          const n = normalizeRange(h.start, h.end)
          return comparePos(n.end, start) < 0 || comparePos(n.start, end) > 0
        })
      })
    },
    [update],
  )

  /**
   * Picking a phrase color. Unlike a rhyme color there is always a tool state
   * here — a new drag has to know what to paint — but when a highlight is
   * selected the pick lands on it too, the way a rhyme swatch lands on the
   * syllable at the cursor. The eraser is a tool only: removing the selected
   * highlight is what Delete is for.
   */
  const pickHighlightColor = useCallback(
    (c: number | 'erase') => {
      setHighlightColor(c)
      if (c === 'erase' || !selectedHighlight) return
      update((draft) => {
        const h = draft.highlights.find((x) => x.id === selectedHighlight)
        if (h) h.color = c
      })
    },
    [selectedHighlight, update],
  )

  const deleteSelectedHighlight = useCallback(() => {
    if (!selectedHighlight) return
    update((draft) => {
      draft.highlights = draft.highlights.filter((h) => h.id !== selectedHighlight)
    })
    setSelectedHighlight(null)
  }, [selectedHighlight, update])

  /* ------------------------------------------------------------------ */
  /* Bar operations                                                      */
  /* ------------------------------------------------------------------ */

  const shiftHighlights = (draft: Song, at: number, delta: number) => {
    draft.highlights.forEach((h) => {
      if (h.start.bar >= at) h.start.bar += delta
      if (h.end.bar >= at) h.end.bar += delta
    })
  }

  const addBar = useCallback(() => {
    update((draft) => {
      draft.bars.push(makeBar(draft.beatsPerBar, draft.defaultDivision))
    })
  }, [update])

  const insertBar = useCallback(() => {
    if (!cursor) return
    update((draft) => {
      draft.bars.splice(cursor.bar, 0, makeBar(draft.beatsPerBar, draft.defaultDivision))
      shiftHighlights(draft, cursor.bar, 1)
    })
  }, [cursor, update])

  const duplicateBar = useCallback(() => {
    if (!cursor) return
    update((draft) => {
      const src = draft.bars[cursor.bar]
      if (!src) return
      draft.bars.splice(cursor.bar + 1, 0, {
        id: makeId('bar'),
        divisions: [...src.divisions],
        slots: JSON.parse(JSON.stringify(src.slots)),
      })
      shiftHighlights(draft, cursor.bar + 1, 1)
    })
  }, [cursor, update])

  const deleteBar = useCallback(() => {
    if (!cursor || song.bars.length <= 1) return
    const at = cursor.bar
    update((draft) => {
      draft.bars.splice(at, 1)
      const last = draft.bars.length - 1
      draft.highlights = draft.highlights
        .filter((h) => !(h.start.bar === at && h.end.bar === at))
        .map((h) => ({
          ...h,
          start: { ...h.start, bar: Math.min(last, h.start.bar > at ? h.start.bar - 1 : h.start.bar) },
          end: { ...h.end, bar: Math.min(last, h.end.bar > at ? h.end.bar - 1 : h.end.bar) },
        }))
    })
    setCursor((cur) => (cur ? { ...cur, bar: Math.max(0, Math.min(cur.bar, song.bars.length - 2)) } : cur))
  }, [cursor, song.bars.length, update])

  /* ------------------------------------------------------------------ */
  /* Song settings                                                       */
  /* ------------------------------------------------------------------ */

  const patchHeader = useCallback(
    (patch: Partial<SongHeader>) => {
      update((draft) => {
        Object.assign(draft.header, patch)
      }, 'header')
    },
    [update],
  )

  const patchSong = useCallback(
    (
      patch: Partial<Pick<Song, 'startBar' | 'ruler' | 'font' | 'defaultDivision' | 'lyricSize' | 'beatWidth' | 'rowGap' | 'rulerLabel'>>,
    ) => {
      // Dragging the size slider fires continuously; keep it to one undo step.
      update((draft) => {
        Object.assign(draft, patch)
      }, 'song-setting')
    },
    [update],
  )

  /* ------------------------------------------------------------------ */
  /* Color palettes                                                     */
  /* ------------------------------------------------------------------ */

  const patchPalettes = useCallback(
    (patch: { palette?: string[]; highlightPalette?: string[] }) => {
      // Dragging a color picker fires continuously; merge it into one undo step.
      update((draft) => {
        if (patch.palette) draft.palette = patch.palette
        if (patch.highlightPalette) draft.highlightPalette = patch.highlightPalette
      }, 'palette')
    },
    [update],
  )

  const savePalettesAsDefault = useCallback(() => {
    const next: StoredPalettes = {
      palette: [...song.palette],
      highlightPalette: [...song.highlightPalette],
    }
    if (storeDefaultPalettes(next)) {
      setStoredPalettes(next)
      flash('Saved as the default for new songs')
    } else {
      flash('Could not save the default — browser storage is unavailable')
    }
  }, [flash, song.highlightPalette, song.palette])

  const forgetDefaultPalettes = useCallback(() => {
    clearStoredPalettes()
    setStoredPalettes(null)
    flash('Forgot the saved default — new songs use the built-in colors')
  }, [flash])

  const loadPalettesFromDefault = useCallback(() => {
    const stored = loadStoredPalettes()
    if (!stored) {
      setStoredPalettes(null)
      flash('No saved default yet')
      return
    }
    patchPalettes({ palette: stored.palette, highlightPalette: stored.highlightPalette })
    flash('Applied the saved default to this song')
  }, [flash, patchPalettes])

  const setBeatsPerBar = useCallback(
    (nRaw: number) => {
      const n = Math.max(1, Math.min(16, Math.round(nRaw) || 1))
      update((draft) => {
        draft.bars.forEach((bar) => {
          const divisions = Array.from(
            { length: n },
            (_, i) => bar.divisions[i] ?? draft.defaultDivision,
          )
          const slots: Record<string, Slot> = {}
          for (const [key, value] of Object.entries(bar.slots)) {
            const beat = Number(key.split(':')[0])
            if (beat < n) slots[key] = value
          }
          bar.divisions = divisions
          bar.slots = slots
        })
        draft.beatsPerBar = n
        draft.highlights.forEach((h) => {
          for (const edge of [h.start, h.end]) {
            edge.beat = Math.min(edge.beat, n - 1)
            const div = draft.bars[edge.bar]?.divisions[edge.beat] ?? draft.defaultDivision
            edge.sub = Math.min(edge.sub, subCount(div) - 1)
          }
        })
      })
      setCursor((cur) => (cur ? { ...cur, beat: Math.min(cur.beat, n - 1) } : cur))
    },
    [update],
  )

  /* ------------------------------------------------------------------ */
  /* File                                                                */
  /* ------------------------------------------------------------------ */

  const doNew = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved changes and start a new song?')) return
    reset(newSong(4, storedPalettes ?? undefined))
    setFileHandle(null)
    setFileName(null)
    setSavedRevision(0)
    setCursor({ bar: 0, beat: 0, sub: 0 })
    setSelectedHighlight(null)
  }, [dirty, reset, storedPalettes])

  const doOpen = useCallback(async () => {
    if (dirty && !window.confirm('Discard unsaved changes and open another song?')) return
    try {
      const result = await openSong()
      if (!result) return
      reset(coerceSong(result.song))
      setFileHandle(result.handle)
      setFileName(result.name)
      setSavedRevision(0)
      setCursor({ bar: 0, beat: 0, sub: 0 })
      setSelectedHighlight(null)
      flash(`Opened ${result.name}`)
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return
      flash(`Could not open that file: ${(err as Error).message}`)
    }
  }, [dirty, flash, reset])

  const doSave = useCallback(
    async (forceDialog: boolean) => {
      try {
        const handle = forceDialog ? await saveSongAs(song) : await saveSong(song, fileHandle)
        if (handle) {
          setFileHandle(handle)
          setFileName(handle.name)
        } else {
          setFileName(suggestedName(song))
        }
        setSavedRevision(revision)
        flash('Saved')
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return
        flash(`Save failed: ${(err as Error).message}`)
      }
    },
    [fileHandle, flash, revision, song],
  )

  // Derived from FILE_EXT so a rename of the format cannot leave this behind.
  const baseName = () => {
    const name = suggestedName(song)
    return name.endsWith(FILE_EXT) ? name.slice(0, -FILE_EXT.length) : name
  }

  /**
   * Run an export against a score rendered offscreen at zoom 1.
   *
   * Zoom is view state, but it changes *layout units* rather than CSS-scaling
   * the element, so serializing the on-screen SVG bakes the current zoom into
   * the file: at 50% a "3×" PNG came out at 1.5× and looked blurry, and the
   * sub-pixel stroke floors flattened the notch hierarchy on top of that.
   * Rendering the same <Score> at zoom 1 makes export independent of the view —
   * `exportScale` then controls resolution and nothing else.
   */
  const withExportSVG = useCallback(
    async <T,>(run: (svg: SVGSVGElement) => Promise<T> | T): Promise<T> => {
      const host = document.createElement('div')
      host.setAttribute('aria-hidden', 'true')
      host.style.cssText = 'position:fixed;left:-100000px;top:0;width:0;height:0;overflow:hidden'
      document.body.appendChild(host)
      const root = createRoot(host)
      const ref: React.RefObject<SVGSVGElement | null> = { current: null }
      try {
        flushSync(() => {
          root.render(
            <Score
              song={song}
              layout={computeLayout(song, 1)}
              mode="annotate"
              cursor={null}
              editingRef={null}
              selectedHighlight={null}
              highlightColor={0}
              onSelectSlot={noop}
              onClearSelection={noop}
              onMoveText={noop}
              onCreateHighlight={noop}
              onEraseHighlights={noop}
              onSelectHighlight={noop}
              svgRef={ref}
            />,
          )
        })
        const svg = ref.current ?? host.querySelector('svg')
        if (!svg) throw new Error('Could not prepare the score for export.')
        return await run(svg)
      } finally {
        // Unmounting synchronously here would land inside React's commit phase.
        setTimeout(() => {
          root.unmount()
          host.remove()
        }, 0)
      }
    },
    [song],
  )

  const doExportPNG = useCallback(async () => {
    try {
      await withExportSVG((svg) => exportPNG(svg, exportScale, `${baseName()}.png`))
      flash(`Exported PNG at ${exportScale}×`)
    } catch (err) {
      flash(`Export failed: ${(err as Error).message}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportScale, flash, song, withExportSVG])

  const doExportSVG = useCallback(async () => {
    try {
      await withExportSVG((svg) => exportSVG(svg, `${baseName()}.svg`))
      flash('Exported SVG')
    } catch (err) {
      flash(`Export failed: ${(err as Error).message}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, song, withExportSVG])

  const doCopyPNG = useCallback(async () => {
    try {
      await withExportSVG((svg) => copyPNGToClipboard(svg, exportScale))
      flash('Copied PNG to clipboard')
    } catch (err) {
      flash(`Copy failed: ${(err as Error).message}`)
    }
  }, [exportScale, flash, withExportSVG])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  /* ------------------------------------------------------------------ */
  /* Text editing overlay                                                */
  /* ------------------------------------------------------------------ */

  const cursorSlot = cursor ? song.bars[cursor.bar]?.slots[slotKey(cursor.beat, cursor.sub)] : undefined
  const [draftText, setDraftText] = useState('')
  /**
   * The same value as `draftText`, kept in a ref so anything that takes the
   * input away can still read what was typed. The overlay does not always get
   * a blur to commit on: the score's hit targets preventDefault on pointerdown
   * so a drag cannot steal focus, and a mode change unmounts the input while it
   * is still focused — neither fires one.
   */
  const draftRef = useRef('')
  const setDraft = useCallback((value: string) => {
    draftRef.current = value
    setDraftText(value)
  }, [])

  /**
   * The colors the cursor's syllable is wearing, for the toolbar's swatch
   * markers. A circle with no `color` is drawn in DEFAULT_COLOR, so that is
   * what the strip marks — otherwise landing on a plain grey circle would show
   * nothing selected while the score plainly shows grey. A slot with no circle
   * can still hold a color (clearing the circle keeps it, so putting one back
   * restores the rhyme); that is marked too, since it is what a color key would
   * be replacing. Null only when there is nothing there at all.
   */
  const shownColor =
    cursorSlot?.circle ? cursorSlot.color ?? DEFAULT_COLOR : cursorSlot?.color ?? null
  const shownColor2 = cursorSlot?.color2 ?? null

  // Same idea in phrase mode: with a highlight selected the strip marks that
  // highlight's color rather than the tool's, so the swatch rows always answer
  // "what colour is the thing I have selected".
  const shownHighlightColor: number | 'erase' =
    (selectedHighlight ? song.highlights.find((h) => h.id === selectedHighlight)?.color : undefined) ??
    highlightColor

  /**
   * The input is a view of the slot under the cursor, so it reloads both when
   * the cursor lands somewhere new *and* when the syllable it is showing
   * changes underneath it — which is what opening a file, starting a new song
   * and undo all do while the cursor stays where it is.
   *
   * Keying on the position alone was a way to lose text: open a file with the
   * cursor still on its landing slot and the position never changes, so the box
   * kept the previous document's empty draft over a slot that now had a
   * syllable — and the next flush wrote that empty draft back over it.
   *
   * Typing does not trip this. `cursorText` only moves when the document does,
   * and in text mode the only thing that writes it is a commit of this same
   * draft.
   */
  const cursorKey = cursor ? `${cursor.bar}:${cursor.beat}:${cursor.sub}` : ''
  const cursorText = cursorSlot?.text ?? ''
  useEffect(() => {
    setDraft(cursorText)
  }, [cursorKey, cursorText, setDraft])

  useEffect(() => {
    if (mode === 'text') inputRef.current?.focus()
  }, [mode, cursorKey])

  const commitText = useCallback(
    (value: string) => {
      if (!cursor) return
      const trimmed = value.trim()
      if ((cursorSlot?.text ?? '') === trimmed) return
      mutateSlot(cursor, (s) => {
        if (trimmed) s.text = trimmed
        else {
          delete s.text
          delete s.tdx
          delete s.tdy
        }
      })
    },
    [cursor, cursorSlot, mutateSlot],
  )

  /**
   * Save whatever is in the overlay input. Safe to call from anywhere that is
   * about to move, hide or unmount it — `commitText` is a no-op when the text
   * has not changed, so an extra call after a real blur costs nothing.
   */
  const flushText = useCallback(() => {
    if (mode === 'text') commitText(draftRef.current)
  }, [mode, commitText])

  /** Clicked off the score — drop whatever the current mode has selected. */
  const clearSelection = useCallback(() => {
    setSelectedHighlight(null)
    // Phrase mode does not draw the cursor, so dropping it there would only
    // disable the bar and division controls with nothing on screen to explain
    // why. The highlight is the only selection that mode shows.
    if (mode === 'highlight') return
    flushText()
    setCursor(null)
  }, [mode, flushText])

  /**
   * Moving the cursor by clicking a slot has to keep the syllable being typed:
   * the click never blurs the input (see `draftRef`), and the cursor landing
   * somewhere new reloads the input from the slot it lands on, so an uncommitted
   * draft would simply be overwritten.
   */
  const selectSlot = useCallback(
    (ref: SlotRef) => {
      flushText()
      setCursor(ref)
      setSelectedHighlight(null)
    },
    [flushText],
  )

  /** Modes are passes over the same document; a half-typed syllable survives one. */
  const switchMode = useCallback(
    (next: Mode) => {
      flushText()
      setMode(next)
    },
    [flushText],
  )

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length

    if (e.key === ' ' || e.code === 'Space' || e.key === 'Tab') {
      e.preventDefault()
      flushText()
      moveBy(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      flushText()
      moveRow(1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      flushText()
      setMode('annotate')
    } else if (e.key === 'ArrowLeft' && atStart) {
      e.preventDefault()
      flushText()
      moveBy(-1)
    } else if (e.key === 'ArrowRight' && atEnd) {
      e.preventDefault()
      flushText()
      moveBy(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      flushText()
      moveRow(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      flushText()
      moveRow(1)
    } else if (e.key === 'Backspace' && draftText === '') {
      e.preventDefault()
      moveBy(-1)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Global keyboard                                                     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod) {
        const k = e.key.toLowerCase()
        if (k === 's') {
          e.preventDefault()
          void doSave(e.shiftKey)
          return
        }
        if (k === 'o') {
          e.preventDefault()
          void doOpen()
          return
        }
        if (k === 'e') {
          e.preventDefault()
          void doExportPNG()
          return
        }
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
          return
        }
        if (k === 'y') {
          e.preventDefault()
          redo()
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          addBar()
          return
        }
        if (k === '1') {
          e.preventDefault()
          switchMode('text')
          return
        }
        if (k === '2') {
          e.preventDefault()
          switchMode('annotate')
          return
        }
        if (k === '3') {
          e.preventDefault()
          switchMode('highlight')
          return
        }
        return
      }

      // Text mode routes its own keys through the input element.
      if (isEditableTarget(e.target)) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveBy(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveBy(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveRow(-1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveRow(1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        moveBarEdge(false)
      } else if (e.key === 'End') {
        e.preventDefault()
        moveBarEdge(true)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        moveBy(e.shiftKey ? -1 : 1)
      } else if (e.code === 'Space' && (mode === 'annotate' || mode === 'highlight')) {
        e.preventDefault()
        moveBy(e.shiftKey ? -1 : 1)
      } else if (mode === 'annotate') {
        // Alt first: on Windows/Linux Alt+1 still reports e.key "1", so the
        // plain-color lookup below would otherwise swallow the second-color
        // binding. Matching on e.code covers macOS, where ⌥1 reports "¡".
        if (e.altKey) {
          const second = colorIndexForKey(e.code, e.key, e.shiftKey)
          if (second >= 0) {
            e.preventDefault()
            applySecondColor(second)
          }
          return
        }
        const colorIndex = COLOR_KEY_HINTS.indexOf(e.key)
        if (colorIndex >= 0) {
          e.preventDefault()
          applyColor(colorIndex)
          return
        }
        switch (e.key) {
          case 'a':
            e.preventDefault()
            setCircle('large', true)
            break
          case 'A':
            e.preventDefault()
            setCircle('large', false)
            break
          case 's':
            e.preventDefault()
            setCircle('small', true)
            break
          case 'S':
            e.preventDefault()
            setCircle('small', false)
            break
          case 'd':
            e.preventDefault()
            setCircle(null, true)
            break
          case 'D':
            e.preventDefault()
            setCircle(null, false)
            break
          case 'q':
          case 'Q':
            e.preventDefault()
            toggleTie()
            break
          case 'Backspace':
          case 'Delete':
            e.preventDefault()
            clearSlot()
            break
          case 'Enter':
            e.preventDefault()
            switchMode('text')
            break
        }
      } else if (mode === 'highlight') {
        if (e.key >= '1' && e.key <= '8') {
          e.preventDefault()
          pickHighlightColor(Number(e.key) - 1)
        } else if (e.key === '0') {
          e.preventDefault()
          pickHighlightColor('erase')
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          deleteSelectedHighlight()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setSelectedHighlight(null)
        }
      } else if (mode === 'text' && e.key === 'Escape') {
        switchMode('annotate')
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    addBar,
    applyColor,
    applySecondColor,
    clearSlot,
    deleteSelectedHighlight,
    doExportPNG,
    doOpen,
    doSave,
    mode,
    moveBarEdge,
    moveBy,
    moveRow,
    pickHighlightColor,
    redo,
    setCircle,
    switchMode,
    toggleTie,
    undo,
  ])

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const cursorPos = cursor
    ? layout.bars[cursor.bar]?.slots.find((s) => s.beat === cursor.beat && s.sub === cursor.sub)
    : undefined
  const cursorRow = cursor ? layout.bars[cursor.bar] : undefined
  const currentDivision = cursor
    ? ((song.bars[cursor.bar]?.divisions[cursor.beat] ?? song.defaultDivision) as Division)
    : null

  return (
    <div className="app">
      <Toolbar
        song={song}
        mode={mode}
        setMode={switchMode}
        rhymeColor={shownColor}
        setRhymeColor={(i) => applyColor(i)}
        rhymeColor2={shownColor2}
        setRhymeColor2={(i) => applySecondColor(i)}
        onClearSecondColor={clearSecondColor}
        highlightColor={shownHighlightColor}
        setHighlightColor={pickHighlightColor}
        currentDivision={currentDivision}
        hasCursor={cursor != null}
        selectedHighlight={selectedHighlight}
        onSetCircle={(k) => setCircle(k, false)}
        onToggleTie={toggleTie}
        onSetDivision={setDivision}
        onDeleteHighlight={deleteSelectedHighlight}
        onAddBar={addBar}
        onInsertBar={insertBar}
        onDuplicateBar={duplicateBar}
        onDeleteBar={deleteBar}
        zoom={zoom}
        setZoom={setZoom}
        exportScale={exportScale}
        setExportScale={setExportScale}
        onNew={doNew}
        onOpen={() => void doOpen()}
        onSave={() => void doSave(false)}
        onSaveAs={() => void doSave(true)}
        onExportPNG={() => void doExportPNG()}
        onExportSVG={() => void doExportSVG()}
        onCopyPNG={() => void doCopyPNG()}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        fileName={fileName}
        dirty={dirty}
        onToggleHelp={() => {
          setShowHelp((v) => !v)
          setShowSettings(false)
          setShowColors(false)
        }}
        onToggleSettings={() => {
          setShowSettings((v) => !v)
          setShowHelp(false)
          setShowColors(false)
        }}
        onToggleColors={() => {
          setShowColors((v) => !v)
          setShowHelp(false)
          setShowSettings(false)
        }}
      />

      <div className="workspace">
        <div
          className="canvas-scroll"
          ref={scrollRef}
          onPointerDown={(e) => {
            // Only the grey surround, never a click that reached the score:
            // anything inside the stage is this element's descendant.
            if (e.target !== e.currentTarget) return
            // Scrollbars report a pointerdown on the element itself; grabbing
            // one is not a click on the background.
            const el = e.currentTarget
            if (e.nativeEvent.offsetX > el.clientWidth || e.nativeEvent.offsetY > el.clientHeight)
              return
            clearSelection()
          }}
        >
          <div className="canvas-stage" style={{ width: layout.width, height: layout.height }}>
            <Score
              song={song}
              layout={layout}
              mode={mode}
              cursor={cursor}
              editingRef={mode === 'text' ? cursor : null}
              selectedHighlight={selectedHighlight}
              highlightColor={highlightColor}
              onSelectSlot={selectSlot}
              onClearSelection={clearSelection}
              onMoveText={onMoveText}
              onCreateHighlight={createHighlight}
              onEraseHighlights={eraseHighlights}
              onSelectHighlight={setSelectedHighlight}
              svgRef={svgRef}
            />

            {mode === 'text' && cursorPos && cursorRow && (
              <input
                ref={inputRef}
                className="slot-input"
                value={draftText}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onTextKeyDown}
                onBlur={flushText}
                style={{
                  left: cursorPos.x - Math.max(cursorPos.cell, 54) / 2 + (cursorSlot?.tdx ?? 0),
                  top: cursorRow.textY - layout.m.textSize + (cursorSlot?.tdy ?? 0),
                  width: Math.max(cursorPos.cell, 54),
                  height: layout.m.textSize * 1.5,
                  fontSize: layout.m.textSize,
                  fontFamily:
                    song.font === 'serif'
                      ? "Georgia, 'Times New Roman', Times, serif"
                      : "'Helvetica Neue', Helvetica, Arial, sans-serif",
                  fontStyle: song.font === 'serif' ? 'italic' : 'normal',
                }}
              />
            )}
          </div>
        </div>

        {showSettings && (
          <SettingsPanel
            song={song}
            onHeader={patchHeader}
            onPatch={patchSong}
            onBeatsPerBar={setBeatsPerBar}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showColors && (
          <PalettePanel
            palette={song.palette}
            highlightPalette={song.highlightPalette}
            onChange={patchPalettes}
            onSaveAsDefault={savePalettesAsDefault}
            onLoadSavedDefault={loadPalettesFromDefault}
            onForgetSavedDefault={forgetDefaultPalettes}
            hasSavedDefault={storedPalettes != null}
            onClose={() => setShowColors(false)}
          />
        )}
        {showHelp && <HelpPanel palette={song.palette} onClose={() => setShowHelp(false)} />}
      </div>

      <footer className="statusbar">
        <span className="mono">
          {/* The count is the number of notches; a compound division names
              itself as well, since 1/5 alone does not say which half you are in. */}
          {cursor && currentDivision
            ? `bar ${song.startBar + cursor.bar} · beat ${cursor.beat + 1} · ` +
              `${cursor.sub + 1}/${subCount(currentDivision)}` +
              (typeof currentDivision === 'string' ? ` (${currentDivision})` : '')
            : 'no slot selected'}
        </span>
        <span className="hint">
          {mode === 'text' && 'Type a syllable · Space advances · Esc → Annotate'}
          {mode === 'annotate' &&
            'A large · S small · D none · Q tie · number keys color · Alt+number second color'}
          {mode === 'highlight' &&
            `Drag across the grid to highlight · ${
              highlightColor === 'erase'
                ? 'eraser'
                : swatchLabel(song.highlightPalette, highlightColor, DEFAULT_HIGHLIGHTS)
            }`}
        </span>
        {status && <span className="status">{status}</span>}
      </footer>
    </div>
  )
}
