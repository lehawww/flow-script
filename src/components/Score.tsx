/**
 * The score itself: one <svg> that is both the editing surface and the exported
 * artwork.
 *
 * Two rules keep those two jobs compatible:
 *   1. Every visual property is a presentation attribute, never a CSS class, so
 *      a serialized clone renders correctly with no stylesheet.
 *   2. Anything that exists only for editing (hit targets, cursor ring,
 *      selection outlines, drag preview) carries data-editor-only and is
 *      stripped before export.
 */

import { useMemo, useRef, useState } from 'react'
import type { Layout } from '../layout'
import { slotAtX, slotEndX, slotStartX, stripeBands } from '../layout'
import {
  comparePos,
  headerLine,
  normalizeRange,
  slotKey,
  type GridPos,
  type Highlight,
  type SlotRef,
  type Song,
} from '../model'
import { phraseFill, rhymeFill } from '../palette'

export type Mode = 'text' | 'annotate' | 'highlight'

const INK = '#111111'
/** Direction of the second-color stripes. Negative = top-left to bottom-right. */
const STRIPE_ANGLE = -45
const FONTS = {
  sans: { family: "'Helvetica Neue', Helvetica, Arial, sans-serif", style: 'normal' },
  serif: { family: "Georgia, 'Times New Roman', Times, serif", style: 'italic' },
} as const

interface Props {
  song: Song
  layout: Layout
  mode: Mode
  cursor: SlotRef | null
  /** Slot whose text is being edited in the HTML overlay — hidden in the SVG. */
  editingRef: SlotRef | null
  selectedHighlight: string | null
  highlightColor: number | 'erase'
  onSelectSlot: (ref: SlotRef) => void
  /** Clicked off the grid — drop whatever is currently selected. */
  onClearSelection: () => void
  onMoveText: (ref: SlotRef, tdx: number, tdy: number) => void
  onCreateHighlight: (a: GridPos, b: GridPos) => void
  onEraseHighlights: (a: GridPos, b: GridPos) => void
  onSelectHighlight: (id: string | null) => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

/**
 * Split a bar-spanning highlight into one rect per bar row. Edges land on
 * subdivision notches: the range runs from the start subdivision's notch to the
 * far side of the end subdivision's cell, so both endpoints are included.
 */
function highlightSegments(h: Highlight, layout: Layout) {
  const { start, end } = normalizeRange(h.start, h.end)
  const segs: { key: string; x: number; y: number; w: number; h: number }[] = []
  for (let b = start.bar; b <= end.bar; b++) {
    const row = layout.bars[b]
    if (!row) continue
    const x = b === start.bar ? slotStartX(row, start.beat, start.sub) : row.x0
    const x2 = b === end.bar ? slotEndX(row, end.beat, end.sub) : row.x1
    if (x2 - x > 0.5) {
      segs.push({ key: `${h.id}-${b}`, x, y: row.top, w: x2 - x, h: row.bottom - row.top })
    }
  }
  return segs
}

export default function Score(props: Props) {
  const { song, layout, mode, cursor, editingRef, svgRef } = props
  const m = layout.m
  const font = FONTS[song.font]
  // The authoritative drag state is a ref: pointerdown/move/up can all arrive
  // before React re-renders, so a handler closing over state would read stale
  // (or null) values. State exists only to drive the preview rectangle.
  const dragRef = useRef<{ a: GridPos; b: GridPos } | null>(null)
  const [dragRange, setDragRange] = useState<{ a: GridPos; b: GridPos } | null>(null)
  const textDrag = useRef<{ ref: SlotRef; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null)

  // Stripe geometry depends only on the radius, so the two circle sizes cover
  // every two-color circle on the page.
  const stripes = useMemo(
    () => ({ large: stripeBands(m.rLarge), small: stripeBands(m.rSmall) }),
    [m.rLarge, m.rSmall],
  )

  /* ---------------- rhyme ties ---------------- */

  const circleSlots: { ref: SlotRef; x: number; row: number; tie: boolean }[] = []
  layout.bars.forEach((row) => {
    row.slots.forEach((p) => {
      const slot = song.bars[p.bar].slots[slotKey(p.beat, p.sub)]
      if (slot?.circle) {
        circleSlots.push({
          ref: { bar: p.bar, beat: p.beat, sub: p.sub },
          x: p.x,
          row: row.index,
          tie: slot.tie === true,
        })
      }
    })
  })

  const tieSegments: { key: string; x1: number; x2: number; y: number }[] = []
  circleSlots.forEach((c, i) => {
    if (!c.tie) return
    const next = circleSlots[i + 1]
    if (!next) return
    for (let r = c.row; r <= next.row; r++) {
      const row = layout.bars[r]
      if (!row) continue
      const x1 = r === c.row ? c.x : row.x0
      const x2 = r === next.row ? next.x : row.x1
      if (x2 - x1 > 0.5) tieSegments.push({ key: `tie-${i}-${r}`, x1, x2, y: row.y })
    }
  })

  /* ---------------- highlight drag ---------------- */

  const localPoint = (evt: React.PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    // The SVG is rendered 1:1 with its viewBox, so client → user space is a
    // straight translation. (Scaling would need the CTM; we deliberately avoid
    // CSS-scaling the score so on-screen px == exported px.)
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  /** Nearest bar row to a y in user space — pointer capture keeps events on the
   *  starting rect, so the row has to come from the coordinate, not the target. */
  const barAtY = (y: number): number => {
    let best = 0
    let bestDist = Infinity
    for (const row of layout.bars) {
      const d = y < row.top ? row.top - y : y > row.bottom ? y - row.bottom : 0
      if (d < bestDist) {
        bestDist = d
        best = row.index
      }
    }
    return best
  }

  const gridPosAt = (evt: React.PointerEvent): GridPos => {
    const { x, y } = localPoint(evt)
    const bar = barAtY(y)
    return { bar, ...slotAtX(layout.bars[bar], x) }
  }

  const capture = (evt: React.PointerEvent) => {
    // Not every pointer id is capturable (synthetic events, already-released
    // pointers); the drag still works off the ref if capture is unavailable.
    try {
      ;(evt.target as Element).setPointerCapture(evt.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onHighlightPointerDown = (evt: React.PointerEvent) => {
    if (mode !== 'highlight') return
    evt.preventDefault()
    capture(evt)
    const ref = gridPosAt(evt)
    dragRef.current = { a: ref, b: ref }
    setDragRange({ a: ref, b: ref })
  }

  const onHighlightPointerMove = (evt: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    drag.b = gridPosAt(evt)
    setDragRange({ a: drag.a, b: drag.b })
  }

  const onHighlightPointerUp = (evt: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    // Take the endpoint from pointerup itself — the last pointermove can lag
    // behind where the drag actually finished.
    if (evt.type === 'pointerup') drag.b = gridPosAt(evt)
    const { a, b } = drag
    dragRef.current = null
    setDragRange(null)
    const isClick = comparePos(a, b) === 0
    if (isClick) {
      const hit = song.highlights.find((h) => {
        const { start, end } = normalizeRange(h.start, h.end)
        return comparePos(a, start) >= 0 && comparePos(a, end) <= 0
      })
      if (hit) {
        props.onSelectHighlight(hit.id)
        return
      }
    }
    props.onSelectHighlight(null)
    if (props.highlightColor === 'erase') props.onEraseHighlights(a, b)
    else props.onCreateHighlight(a, b)
  }

  /* ---------------- background ---------------- */

  /**
   * A point is "on the grid" when it lands inside a bar's block. The backdrop
   * sits behind every real target, so this only decides the strips a bar owns
   * but has no hit target over — past the last notch, mainly. Clicking those
   * should not deselect: they are still part of the bar.
   */
  const onGrid = (x: number, y: number) =>
    layout.bars.some((row) => y >= row.top && y <= row.bottom && x >= row.x0 && x <= row.x1)

  const onBackdropPointerDown = (evt: React.PointerEvent) => {
    const { x, y } = localPoint(evt)
    if (onGrid(x, y)) return
    props.onClearSelection()
  }

  /* ---------------- text drag ---------------- */

  const onTextPointerDown = (evt: React.PointerEvent, ref: SlotRef, tdx: number, tdy: number) => {
    if (mode === 'highlight') return
    evt.stopPropagation()
    capture(evt)
    const p = localPoint(evt)
    textDrag.current = { ref, startX: p.x, startY: p.y, baseX: tdx, baseY: tdy, moved: false }
  }

  const onTextPointerMove = (evt: React.PointerEvent) => {
    const d = textDrag.current
    if (!d) return
    const p = localPoint(evt)
    const dx = p.x - d.startX
    const dy = p.y - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 3) return
    d.moved = true
    props.onMoveText(d.ref, d.baseX + dx, d.baseY + dy)
  }

  const onTextPointerUp = (evt: React.PointerEvent) => {
    const d = textDrag.current
    textDrag.current = null
    if (d && !d.moved) {
      evt.stopPropagation()
      props.onSelectSlot(d.ref)
    }
  }

  /* ---------------- render ---------------- */

  const title = headerLine(song.header)
  const previewRange = dragRange ? normalizeRange(dragRange.a, dragRange.b) : null

  return (
    <svg
      ref={svgRef}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      style={{ display: 'block', background: '#fff', touchAction: 'none' }}
    >
      {/*
        Backdrop. First child, so it is behind every other element and only
        receives the clicks nothing else wanted — the gutter, the margins, the
        ruler strip, the space under the last bar.
      */}
      <rect
        data-editor-only="true"
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        fill="transparent"
        onPointerDown={onBackdropPointerDown}
      />

      {/* phrase-structure highlights */}
      <g>
        {song.highlights.map((h) =>
          highlightSegments(h, layout).map((s) => (
            <rect
              key={s.key}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              fill={phraseFill(song.highlightPalette, h.color)}
              stroke="none"
              pointerEvents="none"
            />
          )),
        )}
      </g>

      {/* selection outline for the picked highlight */}
      {props.selectedHighlight &&
        (() => {
          const h = song.highlights.find((x) => x.id === props.selectedHighlight)
          if (!h) return null
          return (
            <g data-editor-only="true">
              {highlightSegments(h, layout).map((s) => (
                <rect
                  key={`sel-${s.key}`}
                  x={s.x + 0.5}
                  y={s.y + 0.5}
                  width={s.w - 1}
                  height={s.h - 1}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  pointerEvents="none"
                />
              ))}
            </g>
          )}
        )()}

      {/* drag preview */}
      {previewRange && (
        <g data-editor-only="true">
          {highlightSegments(
            { id: 'preview', color: 0, start: previewRange.start, end: previewRange.end },
            layout,
          ).map((s) => (
            <rect
              key={s.key}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              fill={props.highlightColor === 'erase' ? 'none' : phraseFill(song.highlightPalette, props.highlightColor)}
              fillOpacity={0.7}
              stroke="#2563EB"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          ))}
        </g>
      )}

      {/* header */}
      {title && (
        <text
          x={layout.width / 2}
          y={layout.headerY}
          textAnchor="middle"
          fontFamily={font.family}
          fontSize={m.headerSize}
          fill={INK}
        >
          {title}
        </text>
      )}

      {/* top ruler */}
      {song.ruler !== 'none' && (
        <g>
          {song.ruler === 'beats' && song.rulerLabel && (
            <text
              x={layout.x0 - m.labelSize * 0.6}
              y={layout.rulerY}
              textAnchor="end"
              fontFamily={font.family}
              fontSize={m.rulerSize}
              fill={INK}
            >
              beat
            </text>
          )}
          {layout.rulerTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={layout.rulerY}
              textAnchor="middle"
              fontFamily={font.family}
              fontSize={m.rulerSize}
              fill={INK}
            >
              {t.label}
            </text>
          ))}
        </g>
      )}

      {/* bars */}
      {layout.bars.map((row) => (
        <g key={song.bars[row.index].id}>
          <text
            x={row.labelX}
            y={row.labelY}
            textAnchor="end"
            fontFamily={font.family}
            fontSize={m.labelSize}
            fill={INK}
          >
            {row.label}
          </text>

          <line
            x1={row.lineX0}
            y1={row.y}
            x2={row.x1}
            y2={row.y}
            stroke={INK}
            strokeWidth={m.baselineW}
          />

          {row.slots.map((p) => (
            <line
              key={`n-${p.beat}-${p.sub}`}
              x1={p.x}
              y1={row.y}
              x2={p.x}
              y2={row.y - m.notchH[p.level]}
              stroke={INK}
              strokeWidth={m.notchW[p.level]}
            />
          ))}

          {/* No notch at the bar's end: that position is beat 1 of the next
              bar, and drawing it here would double the downbeat. */}
        </g>
      ))}

      {/* rhyme connectors, drawn under the circles */}
      <g>
        {tieSegments.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y}
            x2={t.x2}
            y2={t.y}
            stroke={INK}
            strokeWidth={m.tieW}
            strokeLinecap="butt"
          />
        ))}
      </g>

      {/* stress circles */}
      <g>
        {layout.bars.map((row) =>
          row.slots.map((p) => {
            const slot = song.bars[p.bar].slots[slotKey(p.beat, p.sub)]
            if (!slot?.circle) return null
            const r = slot.circle === 'large' ? m.rLarge : m.rSmall
            const key = `c-${p.bar}-${p.beat}-${p.sub}`
            const fill = rhymeFill(song.palette, slot.color)

            // The common case stays a single <circle>: one element per circle
            // in the exported file, exactly as before two-color circles existed.
            if (slot.color2 === undefined) {
              return (
                <circle
                  key={key}
                  cx={p.x}
                  cy={row.y}
                  r={r}
                  fill={fill}
                  stroke={INK}
                  strokeWidth={m.circleStroke}
                />
              )
            }

            // Two rhymes on one syllable: the second color as diagonal stripes
            // over the first. The outline goes on last so the stripes cannot
            // ride over it.
            return (
              <g key={key}>
                <circle cx={p.x} cy={row.y} r={r} fill={fill} stroke="none" />
                <g transform={`translate(${p.x} ${row.y}) rotate(${STRIPE_ANGLE})`}>
                  {(slot.circle === 'large' ? stripes.large : stripes.small).map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill={rhymeFill(song.palette, slot.color2)}
                      stroke="none"
                    />
                  ))}
                </g>
                <circle
                  cx={p.x}
                  cy={row.y}
                  r={r}
                  fill="none"
                  stroke={INK}
                  strokeWidth={m.circleStroke}
                />
              </g>
            )
          }),
        )}
      </g>

      {/* hit targets (editing only) */}
      {mode !== 'highlight' && (
        <g data-editor-only="true">
          {layout.bars.map((row) =>
            row.slots.map((p) => (
              <rect
                key={`h-${p.bar}-${p.beat}-${p.sub}`}
                x={p.x - p.cell / 2}
                y={row.top}
                width={p.cell}
                height={row.bottom - row.top}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  props.onSelectSlot({ bar: p.bar, beat: p.beat, sub: p.sub })
                }}
              />
            )),
          )}
        </g>
      )}

      {mode === 'highlight' && (
        <g data-editor-only="true">
          {layout.bars.map((row) =>
            Array.from({ length: song.beatsPerBar }, (_, beat) => (
              <rect
                key={`hb-${row.index}-${beat}`}
                x={row.beatEdges[beat]}
                y={row.top}
                width={row.beatEdges[beat + 1] - row.beatEdges[beat]}
                height={row.bottom - row.top}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onPointerDown={onHighlightPointerDown}
                onPointerMove={onHighlightPointerMove}
                onPointerUp={onHighlightPointerUp}
                onLostPointerCapture={onHighlightPointerUp}
              />
            )),
          )}
        </g>
      )}

      {/* syllable text, above hit targets so it can be dragged */}
      <g>
        {layout.bars.map((row) =>
          row.slots.map((p) => {
            const slot = song.bars[p.bar].slots[slotKey(p.beat, p.sub)]
            if (!slot?.text) return null
            const ref = { bar: p.bar, beat: p.beat, sub: p.sub }
            const isEditing =
              editingRef?.bar === p.bar && editingRef.beat === p.beat && editingRef.sub === p.sub
            return (
              <text
                key={`t-${p.bar}-${p.beat}-${p.sub}`}
                x={p.x + (slot.tdx ?? 0)}
                y={row.textY + (slot.tdy ?? 0)}
                textAnchor="middle"
                fontFamily={font.family}
                fontStyle={font.style}
                fontSize={m.textSize}
                fill={INK}
                opacity={isEditing ? 0 : 1}
                style={{ cursor: mode === 'highlight' ? 'crosshair' : 'move', userSelect: 'none' }}
                onPointerDown={(e) => onTextPointerDown(e, ref, slot.tdx ?? 0, slot.tdy ?? 0)}
                onPointerMove={onTextPointerMove}
                onPointerUp={onTextPointerUp}
              >
                {slot.text}
              </text>
            )
          }),
        )}
      </g>

      {/* cursor */}
      {cursor && mode !== 'highlight' && (() => {
        const row = layout.bars[cursor.bar]
        const p = row?.slots.find((s) => s.beat === cursor.beat && s.sub === cursor.sub)
        if (!row || !p) return null
        return (
          <g data-editor-only="true" pointerEvents="none">
            <rect
              x={p.x - p.cell / 2}
              y={row.top}
              width={p.cell}
              height={row.bottom - row.top}
              fill="#2563EB"
              fillOpacity={0.08}
            />
            <rect
              x={p.x - p.cell / 2 + 0.5}
              y={row.top + 0.5}
              width={p.cell - 1}
              height={row.bottom - row.top - 1}
              fill="none"
              stroke="#2563EB"
              strokeWidth={1.5}
            />
          </g>
        )
      })()}
    </svg>
  )
}
