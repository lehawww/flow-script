/**
 * Pure geometry. Turns a Song + zoom into absolute pixel positions.
 *
 * Everything the renderer, the hit-testing and the export path need comes from
 * here, so on-screen layout and exported layout can never drift apart. There is
 * no line wrapping by design: a bar is always one row of `beatsPerBar * pxPerBeat`
 * pixels and the viewport scrolls horizontally instead.
 */

import {
  clampBeatWidth,
  clampLyricSize,
  clampRowGap,
  NOTCH_LEVELS,
  type Division,
  type Song,
} from './model'

/** Unzoomed base metrics, in pixels. */
export const BASE = {
  pxPerBeat: 170,
  gutter: 74, // bar-number column
  padX: 26,
  padY: 22,
  headerH: 56,
  rulerH: 36,
  // Both zones are derived in computeLayout from the ink they have to hold —
  // these are only the floors. See the rowPad comment there.
  aboveBaseline: 36, // notch zone
  belowBaseline: 34, // syllable text zone
  rowGap: 0,
  // Distance from the bar's left edge back to the right edge of its number, so
  // the gutter reads as its own column instead of the number crowding beat 1.
  labelGap: 30,
  // Air between the row's ink and the edge of its block. Applied equally above
  // and below, which is what keeps a phrase highlight centred on the row.
  rowPad: 6,
  notchH: [30, 21, 13, 8],
  // Level 0 is the beat. Strictly descending, and every entry stays under
  // baselineW so the measure line reads as the heaviest stroke on the row.
  notchW: [1.9, 1.45, 1, 0.8],
  rLarge: 11,
  rSmall: 6.5,
  circleStroke: 1.6,
  tieW: 5,
  textSize: 15,
  // Matches rulerSize on purpose: the bar numbers down the side and the beat
  // numbers along the top are one labelling system and must not differ in size.
  labelSize: 15,
  headerSize: 22,
  rulerSize: 15,
  // The measure line reads as the spine of the bar, so it sits a step above the
  // heaviest notch rather than under it.
  baselineW: 2.7,
}

export type Metrics = typeof BASE

export interface SlotPos {
  bar: number
  beat: number
  sub: number
  x: number
  level: number
  /** Horizontal room this slot owns, used to size hit targets and text boxes. */
  cell: number
}

export interface BarLayout {
  index: number
  /** Label shown in the gutter. */
  label: number
  y: number // baseline
  /**
   * The row's vertical extent, and so also a phrase highlight's. The block
   * holds the row's ink with `rowPad` of air on each side, so the highlight
   * reads as centred and consecutive bars' highlights meet flush at zero
   * vertical padding.
   */
  top: number
  bottom: number
  textY: number
  /** Text baseline that puts the gutter label in the row's vertical middle. */
  labelY: number
  /** Right edge of the gutter's bar number (the text is end-anchored here). */
  labelX: number
  x0: number
  x1: number
  /**
   * Where the measure line starts. Half a beat-notch further left than `x0`:
   * the beat-1 stroke is centred on `x0`, so a line beginning exactly at `x0`
   * would leave that stroke's left half hanging past the end of it.
   */
  lineX0: number
  slots: SlotPos[]
  /** x of each beat boundary, length beatsPerBar + 1. */
  beatEdges: number[]
}

export interface Layout {
  m: Metrics
  width: number
  height: number
  x0: number
  barWidth: number
  headerY: number
  rulerY: number
  bars: BarLayout[]
  /** Ruler tick label positions, empty when song.ruler === 'none'. */
  rulerTicks: { x: number; label: string }[]
  rowPitch: number
}

function scaleMetrics(zoom: number): Metrics {
  const s = (n: number) => n * zoom
  return {
    pxPerBeat: s(BASE.pxPerBeat),
    gutter: s(BASE.gutter),
    padX: s(BASE.padX),
    padY: s(BASE.padY),
    headerH: s(BASE.headerH),
    rulerH: s(BASE.rulerH),
    aboveBaseline: s(BASE.aboveBaseline),
    belowBaseline: s(BASE.belowBaseline),
    rowGap: s(BASE.rowGap),
    labelGap: s(BASE.labelGap),
    rowPad: s(BASE.rowPad),
    notchH: BASE.notchH.map(s),
    // Floor at half a pixel, not a whole one: a 1px floor would clamp the two
    // lightest levels to the same weight at 100% zoom and flatten the ramp.
    // Sub-pixel strokes anti-alias on screen and rasterise crisply on export.
    notchW: BASE.notchW.map((n) => Math.max(0.5, s(n))),
    rLarge: s(BASE.rLarge),
    rSmall: s(BASE.rSmall),
    circleStroke: Math.max(1, s(BASE.circleStroke)),
    tieW: s(BASE.tieW),
    textSize: s(BASE.textSize),
    labelSize: s(BASE.labelSize),
    headerSize: s(BASE.headerSize),
    rulerSize: s(BASE.rulerSize),
    baselineW: Math.max(1, s(BASE.baselineW)),
  }
}

export function computeLayout(song: Song, zoom: number): Layout {
  const m = scaleMetrics(zoom)
  // The lyric size is a document setting, not a fixed metric; the row's text
  // zone grows with it so big text does not collide with the next bar.
  m.textSize = clampLyricSize(song.lyricSize) * zoom
  // Both zones are the ink they hold plus the same `rowPad` of air. Equal air
  // is what makes a phrase highlight — which fills the row block — sit centred
  // on the row instead of trailing a slab of colour under the lyrics, and it
  // is why bars meet flush at zero vertical padding rather than showing a gap.
  // The text zone still grows with the lyric size, so big text cannot collide
  // with the next bar.
  // Assigned, not floored: a floor on either side would quietly break the
  // symmetry at the sizes where it bound.
  m.aboveBaseline = Math.max(m.notchH[0], m.rLarge + m.circleStroke) + m.rowPad
  // rLarge clears the circle, then the lyric's own baseline offset and its
  // descenders — the same 0.92 + 0.26 of textSize that `textY` is built from.
  m.belowBaseline = m.rLarge + m.textSize * 1.18 + m.rowPad
  // Beat width is a document setting too — it is how a syllable gets more
  // horizontal room, which zoom (scaling everything) cannot give.
  m.pxPerBeat = clampBeatWidth(song.beatWidth) * zoom
  m.rowGap = clampRowGap(song.rowGap) * zoom
  const hasHeader = Object.values(song.header).some((v) => v.trim() !== '')
  const headerH = hasHeader ? m.headerH : 0
  const rulerH = song.ruler === 'none' ? 0 : m.rulerH

  const x0 = m.padX + m.gutter
  const barWidth = song.beatsPerBar * m.pxPerBeat
  const rowPitch = m.aboveBaseline + m.belowBaseline + m.rowGap

  const headerY = m.padY + m.headerH * 0.62
  const rulerY = m.padY + headerH + rulerH * 0.7
  const contentTop = m.padY + headerH + rulerH

  const bars: BarLayout[] = song.bars.map((bar, index) => {
    const top = contentTop + index * rowPitch
    const y = top + m.aboveBaseline
    const slots: SlotPos[] = []
    for (let beat = 0; beat < song.beatsPerBar; beat++) {
      const div = (bar.divisions[beat] ?? song.defaultDivision) as Division
      const levels = NOTCH_LEVELS[div]
      const cell = m.pxPerBeat / div
      for (let sub = 0; sub < div; sub++) {
        slots.push({
          bar: index,
          beat,
          sub,
          x: x0 + beat * m.pxPerBeat + sub * cell,
          level: levels[sub] ?? levels[levels.length - 1],
          cell,
        })
      }
    }
    const beatEdges = Array.from(
      { length: song.beatsPerBar + 1 },
      (_, i) => x0 + i * m.pxPerBeat,
    )
    const bottom = y + m.belowBaseline
    return {
      index,
      label: song.startBar + index,
      y,
      top,
      bottom,
      // Clear of a large circle's lower edge (rLarge) plus a little air.
      textY: y + m.rLarge + m.textSize * 0.92,
      // Centred on the vertical run of the beat notch — the tallest stroke on
      // the row — so the number reads as belonging to that downbeat.
      labelY: y - m.notchH[0] / 2 + m.labelSize * 0.36,
      labelX: x0 - m.labelGap,
      x0,
      x1: x0 + barWidth,
      lineX0: x0 - m.notchW[0] / 2,
      slots,
      beatEdges,
    }
  })

  const rulerTicks: { x: number; label: string }[] = []
  if (song.ruler === 'beats') {
    for (let b = 0; b < song.beatsPerBar; b++) {
      rulerTicks.push({ x: x0 + b * m.pxPerBeat, label: String(b + 1) })
    }
  } else if (song.ruler === 'index') {
    // 16th-note index across the bar, matching the 0..15 rulers in the references.
    const per = 4
    for (let b = 0; b < song.beatsPerBar; b++) {
      for (let s = 0; s < per; s++) {
        rulerTicks.push({
          x: x0 + b * m.pxPerBeat + (s * m.pxPerBeat) / per,
          label: String(b * per + s),
        })
      }
    }
  }

  const lastBar = bars[bars.length - 1]
  return {
    m,
    width: x0 + barWidth + m.padX,
    height: (lastBar ? lastBar.bottom : contentTop) + m.padY,
    x0,
    barWidth,
    headerY,
    rulerY,
    bars,
    rulerTicks,
    rowPitch,
  }
}

/* ------------------------------------------------------------------ */
/* Two-color circles                                                   */
/* ------------------------------------------------------------------ */

/**
 * One stripe period (a band plus the gap after it), as a fraction of the
 * circle's radius. Deriving it from the radius rather than fixing it in pixels
 * keeps the stripe *count* constant, so a small unstressed circle reads as the
 * same mark as a large one instead of collapsing to a single band.
 */
export const STRIPE_PERIOD = 0.82

/**
 * The second color's bands on a two-color circle, as path `d` strings in a
 * coordinate system centred on the circle. Each band is the slice of the disc
 * between two parallel chords: two arcs joined by two straight edges. The
 * caller rotates the whole set into the diagonal.
 *
 * Real geometry rather than an SVG `<pattern>` on purpose. A pattern is a
 * `url(#id)` reference, and the export path renders a second <Score> into the
 * same document (see withExportSVG) — two live SVGs carrying the same ids,
 * where a fragment reference resolves to whichever element comes first. A path
 * carries its own geometry and cannot bind to the wrong node.
 *
 * The bands depend only on the radius, so a render computes one set per circle
 * size and reuses it for every circle on the page.
 */
export function stripeBands(r: number): string[] {
  const period = r * STRIPE_PERIOD
  const halfBand = period / 4
  const n = (v: number) => Math.round(v * 1000) / 1000
  const out: string[] = []
  // A band centred on the circle's centre, then outwards symmetrically until
  // the next one would fall clear of the disc.
  const kMax = Math.ceil((r + halfBand) / period)
  for (let k = -kMax; k <= kMax; k++) {
    const a = Math.max(-r, k * period - halfBand)
    const b = Math.min(r, k * period + halfBand)
    if (b - a < 0.01) continue
    // Half-chord length at each edge: where that edge meets the circle.
    const ya = Math.sqrt(Math.max(0, r * r - a * a))
    const yb = Math.sqrt(Math.max(0, r * r - b * b))
    out.push(
      `M ${n(a)} ${n(-ya)}` +
        ` A ${n(r)} ${n(r)} 0 0 1 ${n(b)} ${n(-yb)}` +
        ` L ${n(b)} ${n(yb)}` +
        ` A ${n(r)} ${n(r)} 0 0 1 ${n(a)} ${n(ya)} Z`,
    )
  }
  return out
}

/** Default (unnudged) text anchor for a slot. */
export function textAnchorY(row: BarLayout): number {
  return row.textY
}

/** The slot in `row` whose cell contains user-space `x`, clamped to the bar. */
export function slotAtX(row: BarLayout, x: number): { beat: number; sub: number } {
  let best = row.slots[0]
  for (const p of row.slots) {
    if (x < p.x) break
    best = p
  }
  return { beat: best.beat, sub: best.sub }
}

function findSlot(row: BarLayout, beat: number, sub: number): SlotPos | undefined {
  return row.slots.find((p) => p.beat === beat && p.sub === sub)
}

/**
 * Left edge of a subdivision — its notch. Falls back to the nearest slot in the
 * beat if `sub` no longer exists, which happens when a beat is re-divided under
 * an existing highlight.
 */
export function slotStartX(row: BarLayout, beat: number, sub: number): number {
  const exact = findSlot(row, beat, sub)
  if (exact) return exact.x
  const inBeat = row.slots.filter((p) => p.beat === beat)
  if (!inBeat.length) return row.x0
  return inBeat[Math.min(sub, inBeat.length - 1)].x
}

/** Right edge of a subdivision: the next notch along, so the cell is included. */
export function slotEndX(row: BarLayout, beat: number, sub: number): number {
  const exact = findSlot(row, beat, sub)
  if (exact) return Math.min(row.x1, exact.x + exact.cell)
  const inBeat = row.slots.filter((p) => p.beat === beat)
  if (!inBeat.length) return row.x1
  const p = inBeat[Math.min(sub, inBeat.length - 1)]
  return Math.min(row.x1, p.x + p.cell)
}
