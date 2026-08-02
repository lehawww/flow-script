/**
 * Core data model for a FlowScript song.
 *
 * Coordinate vocabulary used throughout the app:
 *   bar   - index into song.bars (0-based). Displayed label is song.startBar + bar.
 *   beat  - index into a bar, 0 .. song.beatsPerBar-1.
 *   sub   - index into a beat's subdivisions, 0 .. subCount(bar.divisions[beat])-1.
 *           Even spacing is not guaranteed: a beat may be divided in half first
 *           and each half divided differently ("3+2").
 *
 * A (bar, beat, sub) triple is a "slot": one notch on the ruler that can hold a
 * syllable of text and/or a stress circle. Slots are stored sparsely — most
 * slots in a real song are empty, so `Bar.slots` is a map keyed by `beat:sub`
 * rather than a dense array.
 */

import {
  coercePalette,
  defaultHighlightPalette,
  defaultPalette,
  DEFAULT_HIGHLIGHTS,
  DEFAULT_PALETTE,
} from './palette'

/** A beat cut into `n` even subdivisions. */
export type UniformDivision = 1 | 2 | 3 | 4 | 6 | 8

/**
 * A beat cut in half first, each half then divided on its own — `'3+2'` is a
 * triplet across the first 8th and two 16ths across the second.
 *
 * Only the mixed pairs are listed: the even ones already exist as uniform
 * divisions (2+2 is 4, 3+3 is 6, 4+4 is 8), and having one spelling per grid
 * keeps `===` comparisons of a beat's division meaningful.
 */
export type CompoundDivision = '3+2' | '2+3' | '3+4' | '4+3'

export type Division = UniformDivision | CompoundDivision

export const DEFAULT_LYRIC_SIZE = 15
export const MIN_LYRIC_SIZE = 7
export const MAX_LYRIC_SIZE = 40

/** Keeps the lyric size in a range that still lays out sensibly. */
export function clampLyricSize(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_LYRIC_SIZE
  return Math.min(MAX_LYRIC_SIZE, Math.max(MIN_LYRIC_SIZE, v))
}

export const DEFAULT_BEAT_WIDTH = 170
export const MIN_BEAT_WIDTH = 80
export const MAX_BEAT_WIDTH = 480

export function clampBeatWidth(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_BEAT_WIDTH
  return Math.min(MAX_BEAT_WIDTH, Math.max(MIN_BEAT_WIDTH, v))
}

export const DEFAULT_ROW_GAP = 0
export const MIN_ROW_GAP = 0
export const MAX_ROW_GAP = 160

/** Vertical padding between bar rows. 0 is legal — bars simply sit flush. */
export function clampRowGap(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_ROW_GAP
  return Math.min(MAX_ROW_GAP, Math.max(MIN_ROW_GAP, v))
}

export const UNIFORM_DIVISIONS: UniformDivision[] = [1, 2, 3, 4, 6, 8]
export const COMPOUND_DIVISIONS: CompoundDivision[] = ['3+2', '2+3', '3+4', '4+3']
export const DIVISIONS: Division[] = [...UNIFORM_DIVISIONS, ...COMPOUND_DIVISIONS]

/**
 * Narrows a value from a `<select>` or a loaded file to a Division. A numeric
 * division may arrive as the string a `<select>` gives back, so `"8"` is taken;
 * anything that is not a number or a string is not coerced into one, or
 * `true` and `[4]` would both come out as real divisions.
 */
export function parseDivision(v: unknown, fallback: Division = 4): Division {
  if (COMPOUND_DIVISIONS.includes(v as CompoundDivision)) return v as CompoundDivision
  if (typeof v !== 'number' && typeof v !== 'string') return fallback
  const n = Number(v)
  return UNIFORM_DIVISIONS.includes(n as UniformDivision) ? (n as UniformDivision) : fallback
}

/** Large circle = stressed syllable, small circle = unstressed. */
export type CircleKind = 'large' | 'small'

export interface Slot {
  /** Syllable text rendered below the notch. */
  text?: string
  /** Manual nudge of the text away from its default centered position. */
  tdx?: number
  tdy?: number
  circle?: CircleKind
  /** Index into PALETTE (0 = default grey). */
  color?: number
  /**
   * A second rhyme this syllable belongs to, drawn as diagonal stripes of this
   * color over the `color` fill. Set when one syllable is shared by two rhymes
   * — the overlap in "drop it in the pocket", where "drop / it" belong both to
   * the earlier rhyme and to the new multi built on "pock- / et".
   *
   * Undefined is the normal case: a plain, solid circle.
   */
  color2?: number
  /** Draw a thick rhyme connector from this circle to the next circle. */
  tie?: boolean
}

export interface Bar {
  id: string
  /** One entry per beat; length must equal song.beatsPerBar. */
  divisions: Division[]
  slots: Record<string, Slot>
}

/**
 * A position a phrase highlight can start or end at: the same (bar, beat, sub)
 * grid the syllables sit on, so a phrase can begin and end part-way through a
 * beat.
 */
export interface GridPos {
  bar: number
  beat: number
  sub: number
}

/** Inclusive range of subdivisions, may span bars. */
export interface Highlight {
  id: string
  /** Index into HIGHLIGHTS. */
  color: number
  start: GridPos
  end: GridPos
}

/** Reading-order comparison of two grid positions. */
export function comparePos(a: GridPos, b: GridPos): number {
  if (a.bar !== b.bar) return a.bar - b.bar
  if (a.beat !== b.beat) return a.beat - b.beat
  return a.sub - b.sub
}

/** Order a pair of endpoints so start <= end in reading order. */
export function normalizeRange(a: GridPos, b: GridPos): { start: GridPos; end: GridPos } {
  return comparePos(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a }
}

export interface SongHeader {
  verse: string
  title: string
  artist: string
  year: string
  timestamp: string
}

export interface Song {
  version: 1
  header: SongHeader
  beatsPerBar: number
  /** Label shown for bars[0]; may be 0 or any other integer. */
  startBar: number
  defaultDivision: Division
  ruler: 'beats' | 'index' | 'none'
  /** Whether the word "beat" prefixes the top ruler. */
  rulerLabel: boolean
  /** Vertical padding between bar rows, in unzoomed px. */
  rowGap: number
  font: 'sans' | 'serif'
  /** Syllable text size in unzoomed px. Layout spacing follows it. */
  lyricSize: number
  /**
   * Width of one beat in unzoomed px. Unlike zoom (which scales everything),
   * this changes how much horizontal room a syllable gets — the knob that stops
   * larger lyric text colliding with its neighbours.
   */
  beatWidth: number
  /**
   * Colors travel with the song so a file always reopens and exports the way
   * it was made. Fixed length (PALETTE_SIZE / HIGHLIGHT_SIZE) because slots and
   * highlights reference colors by index.
   */
  palette: string[]
  highlightPalette: string[]
  bars: Bar[]
  highlights: Highlight[]
}

/* ------------------------------------------------------------------ */
/* Notch levels                                                        */
/* ------------------------------------------------------------------ */

/**
 * Visual weight of each subdivision within a beat. Level 0 is the beat itself
 * (tallest + thickest); higher levels are progressively shorter and thinner.
 *
 * Div 3 gives the two off-beats the same small level (triplets are even).
 * Div 8 halves repeatedly, so each binary depth gets its own level.
 */
export const NOTCH_LEVELS: Record<UniformDivision, number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 2, 2],
  4: [0, 2, 1, 2],
  6: [0, 2, 2, 1, 2, 2],
  8: [0, 3, 2, 3, 1, 3, 2, 3],
}

/** One notch: where it sits in its beat and how much of the beat it owns, both as fractions. */
export interface SubPos {
  /** Distance from the start of the beat, 0 <= at < 1. */
  at: number
  /** Width of this subdivision — not constant once a beat's halves differ. */
  width: number
  /** Index into notchH / notchW. */
  level: number
}

/**
 * A compound division's halves are not given their own level table. Each half
 * is read out of the uniform division it *would* be if both halves matched —
 * a half in 3 is the corresponding half of division 6 — so the mixed grids and
 * the even ones cannot drift apart, and the middle notch keeps the level that
 * marks the half of a beat.
 */
function halfLevels(half: number, second: boolean): number[] {
  const levels = NOTCH_LEVELS[(half * 2) as UniformDivision]
  return second ? levels.slice(half) : levels.slice(0, half)
}

// Every subdivision table depends only on the division, so one is built per
// division and reused: computeLayout asks for one per beat on every render.
const subCache = new Map<Division, readonly SubPos[]>()

/** The notches of one beat, in order. Treat the result as read-only. */
export function beatSubdivisions(div: Division): readonly SubPos[] {
  const cached = subCache.get(div)
  if (cached) return cached
  const out: SubPos[] = []
  if (typeof div === 'number') {
    const levels = NOTCH_LEVELS[div]
    for (let i = 0; i < div; i++) {
      out.push({ at: i / div, width: 1 / div, level: levels[i] ?? levels[levels.length - 1] })
    }
  } else {
    const [a, b] = div.split('+').map(Number)
    const first = halfLevels(a, false)
    const second = halfLevels(b, true)
    for (let i = 0; i < a; i++) out.push({ at: i / (a * 2), width: 1 / (a * 2), level: first[i] })
    for (let i = 0; i < b; i++) {
      out.push({ at: 0.5 + i / (b * 2), width: 1 / (b * 2), level: second[i] })
    }
  }
  const frozen = Object.freeze(out)
  subCache.set(div, frozen)
  return frozen
}

/** How many notches a beat carries. Equals the division itself when it is uniform. */
export function subCount(div: Division): number {
  return beatSubdivisions(div).length
}

/**
 * The notch sitting exactly `at` through the beat, or -1 if this division has
 * none there. This is what decides whether an annotation survives a re-division:
 * a position is kept only if the new grid has a notch at the same instant.
 */
export function subAtFraction(div: Division, at: number): number {
  const subs = beatSubdivisions(div)
  for (let i = 0; i < subs.length; i++) {
    if (Math.abs(subs[i].at - at) < 1e-9) return i
  }
  return -1
}

/* ------------------------------------------------------------------ */
/* Slot addressing                                                     */
/* ------------------------------------------------------------------ */

export interface SlotRef {
  bar: number
  beat: number
  sub: number
}

export const slotKey = (beat: number, sub: number) => `${beat}:${sub}`

export function getSlot(song: Song, ref: SlotRef): Slot | undefined {
  return song.bars[ref.bar]?.slots[slotKey(ref.beat, ref.sub)]
}

export function sameRef(a: SlotRef | null, b: SlotRef | null): boolean {
  if (!a || !b) return a === b
  return a.bar === b.bar && a.beat === b.beat && a.sub === b.sub
}

/** All slots in reading order — used for cursor movement and rhyme ties. */
export function allSlotRefs(song: Song): SlotRef[] {
  const out: SlotRef[] = []
  song.bars.forEach((bar, b) => {
    for (let beat = 0; beat < song.beatsPerBar; beat++) {
      const div = bar.divisions[beat] ?? song.defaultDivision
      const n = subCount(div)
      for (let sub = 0; sub < n; sub++) out.push({ bar: b, beat, sub })
    }
  })
  return out
}

export function refIndex(refs: SlotRef[], ref: SlotRef | null): number {
  if (!ref) return -1
  return refs.findIndex((r) => sameRef(r, ref))
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

let idCounter = 0
export function makeId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

export function makeBar(beatsPerBar: number, division: Division): Bar {
  return {
    id: makeId('bar'),
    divisions: Array.from({ length: beatsPerBar }, () => division),
    slots: {},
  }
}

/**
 * A blank song. `palettes` lets the caller seed a team's saved default scheme;
 * omitting it keeps `newSong` pure and gives the built-in colors.
 */
export function newSong(bars = 4, palettes?: { palette: string[]; highlightPalette: string[] }): Song {
  const beatsPerBar = 4
  const defaultDivision: Division = 4
  return {
    version: 1,
    header: { verse: '', title: '', artist: '', year: '', timestamp: '' },
    beatsPerBar,
    startBar: 1,
    defaultDivision,
    ruler: 'beats',
    rulerLabel: true,
    rowGap: DEFAULT_ROW_GAP,
    font: 'sans',
    lyricSize: DEFAULT_LYRIC_SIZE,
    beatWidth: DEFAULT_BEAT_WIDTH,
    palette: palettes ? [...palettes.palette] : defaultPalette(),
    highlightPalette: palettes ? [...palettes.highlightPalette] : defaultHighlightPalette(),
    bars: Array.from({ length: bars }, () => makeBar(beatsPerBar, defaultDivision)),
    highlights: [],
  }
}

/** Renders the caption in the reference form: `Verse 2, “Song Title,” Artist (1994), 1:04` */
export function headerLine(h: SongHeader): string {
  const verse = h.verse.trim()
  const title = h.title.trim()
  const artist = h.artist.trim()
  const year = h.year.trim()
  const stamp = h.timestamp.trim()

  let line = ''
  const add = (text: string, sep = ' ') => {
    line = line ? line + sep + text : text
  }
  // The verse number is comma-separated; the title carries its comma inside the
  // closing quote, so nothing is added after it.
  if (verse) add(verse + ',')
  if (title) add(`“${title},”`)
  if (artist) add(artist)
  if (year) add(`(${year})`)
  if (stamp) add(stamp, ', ')
  return line
}

/* ------------------------------------------------------------------ */
/* Validation / migration for loaded files                             */
/* ------------------------------------------------------------------ */

/**
 * Coerce arbitrary parsed JSON into a valid Song. Throws on anything that
 * clearly is not a FlowScript file; repairs anything that is merely incomplete
 * (older exports, hand-edited files, bars whose division array got out of sync
 * with beatsPerBar).
 */
export function coerceSong(raw: unknown): Song {
  if (!raw || typeof raw !== 'object') throw new Error('File is not a FlowScript song.')
  const r = raw as Record<string, any>
  if (!Array.isArray(r.bars)) throw new Error('File is missing a "bars" array.')

  const beatsPerBar = Math.max(1, Math.round(Number(r.beatsPerBar) || 4))
  const defaultDivision = parseDivision(r.defaultDivision, 4)

  const bars: Bar[] = r.bars.map((b: any): Bar => {
    const divisions: Division[] = Array.from({ length: beatsPerBar }, (_, i) => {
      const d = Array.isArray(b?.divisions) ? b.divisions[i] : undefined
      return parseDivision(d, defaultDivision)
    })
    const slots: Record<string, Slot> = {}
    const rawSlots = b?.slots && typeof b.slots === 'object' ? b.slots : {}
    for (const [key, value] of Object.entries(rawSlots)) {
      const [beat, sub] = key.split(':').map(Number)
      if (!Number.isInteger(beat) || !Number.isInteger(sub)) continue
      if (beat < 0 || beat >= beatsPerBar) continue
      if (sub < 0 || sub >= subCount(divisions[beat])) continue
      const v = value as any
      const slot: Slot = {}
      if (typeof v?.text === 'string') slot.text = v.text
      if (Number.isFinite(v?.tdx)) slot.tdx = Number(v.tdx)
      if (Number.isFinite(v?.tdy)) slot.tdy = Number(v.tdy)
      if (v?.circle === 'large' || v?.circle === 'small') slot.circle = v.circle
      if (Number.isInteger(v?.color)) slot.color = Number(v.color)
      if (Number.isInteger(v?.color2)) slot.color2 = Number(v.color2)
      if (v?.tie === true) slot.tie = true
      if (Object.keys(slot).length) slots[slotKey(beat, sub)] = slot
    }
    return { id: typeof b?.id === 'string' ? b.id : makeId('bar'), divisions, slots }
  })

  const maxBar = Math.max(0, bars.length - 1)
  const clampBeat = (n: unknown) => Math.min(beatsPerBar - 1, Math.max(0, Math.round(Number(n) || 0)))
  const clampBar = (n: unknown) => Math.min(maxBar, Math.max(0, Math.round(Number(n) || 0)))

  /**
   * Highlights used to be beat-granular, with no `sub`. Migrate those by
   * expanding each endpoint to cover its whole beat — start at the first
   * subdivision, end at the last — so an older file looks unchanged on screen.
   */
  const clampSub = (bar: number, beat: number, n: unknown, whenMissing: 'first' | 'last') => {
    const last = subCount(bars[bar]?.divisions[beat] ?? defaultDivision) - 1
    if (n === undefined || n === null || !Number.isFinite(Number(n))) {
      return whenMissing === 'last' ? last : 0
    }
    return Math.min(last, Math.max(0, Math.round(Number(n))))
  }

  const gridPos = (raw: any, whenMissing: 'first' | 'last'): GridPos => {
    const bar = clampBar(raw?.bar)
    const beat = clampBeat(raw?.beat)
    return { bar, beat, sub: clampSub(bar, beat, raw?.sub, whenMissing) }
  }

  const highlights: Highlight[] = Array.isArray(r.highlights)
    ? r.highlights
        .filter((h: any) => h && h.start && h.end)
        .map((h: any) => ({
          id: typeof h.id === 'string' ? h.id : makeId('hl'),
          color: Number.isInteger(h.color) ? h.color : 0,
          start: gridPos(h.start, 'first'),
          end: gridPos(h.end, 'last'),
        }))
    : []

  const h = r.header ?? {}
  return {
    version: 1,
    header: {
      verse: String(h.verse ?? ''),
      title: String(h.title ?? ''),
      artist: String(h.artist ?? ''),
      year: String(h.year ?? ''),
      timestamp: String(h.timestamp ?? ''),
    },
    beatsPerBar,
    startBar: Number.isFinite(r.startBar) ? Math.round(r.startBar) : 1,
    defaultDivision,
    ruler: r.ruler === 'index' || r.ruler === 'none' ? r.ruler : 'beats',
    rulerLabel: r.rulerLabel !== false,
    rowGap: clampRowGap(r.rowGap),
    font: r.font === 'serif' ? 'serif' : 'sans',
    lyricSize: clampLyricSize(r.lyricSize),
    beatWidth: clampBeatWidth(r.beatWidth),
    // Files written before palettes were editable have none; they fall back to
    // the built-in colors, which is exactly how they used to render.
    palette: coercePalette(r.palette, DEFAULT_PALETTE),
    highlightPalette: coercePalette(r.highlightPalette, DEFAULT_HIGHLIGHTS),
    bars: bars.length ? bars : [makeBar(beatsPerBar, defaultDivision)],
    highlights,
  }
}
