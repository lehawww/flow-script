/**
 * Top chrome: file actions, mode switch, and the mode-specific tool strip.
 *
 * Every control here has a keyboard equivalent (see HelpPanel) — the buttons
 * exist for discoverability, but the expected workflow for volume work is
 * keyboard-only.
 */

import {
  COMPOUND_DIVISIONS,
  UNIFORM_DIVISIONS,
  type CircleKind,
  type Division,
  type Song,
} from '../model'
import {
  COLOR_KEY_HINTS,
  DEFAULT_COLOR,
  DEFAULT_HIGHLIGHTS,
  DEFAULT_PALETTE,
  rhymeFill,
  swatchLabel,
} from '../palette'
import type { Mode } from './Score'

interface Props {
  song: Song
  mode: Mode
  setMode: (m: Mode) => void
  /**
   * The colors on the syllable at the cursor, marked in the swatch rows. Null
   * when that position carries none — the strip shows what is there, it is not
   * a "current color" you load before painting.
   */
  rhymeColor: number | null
  setRhymeColor: (i: number) => void
  /** Second rhyme color, striped over the first. */
  rhymeColor2: number | null
  setRhymeColor2: (i: number) => void
  onClearSecondColor: () => void
  highlightColor: number | 'erase'
  setHighlightColor: (i: number | 'erase') => void
  currentDivision: Division | null
  hasCursor: boolean
  selectedHighlight: string | null

  onSetCircle: (kind: CircleKind | null) => void
  onToggleTie: () => void
  onSetDivision: (d: Division, scope: 'beat' | 'bar' | 'all') => void
  onDeleteHighlight: () => void

  onAddBar: () => void
  onInsertBar: () => void
  onDuplicateBar: () => void
  onDeleteBar: () => void

  zoom: number
  setZoom: (z: number) => void
  exportScale: number
  setExportScale: (s: number) => void

  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onExportPNG: () => void
  onExportSVG: () => void
  onCopyPNG: () => void

  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean

  fileName: string | null
  dirty: boolean
  onToggleHelp: () => void
  onToggleSettings: () => void
  onToggleColors: () => void
}

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'text', label: 'Text', hint: 'Ctrl+1 — type syllables' },
  { id: 'annotate', label: 'Annotate', hint: 'Ctrl+2 — stress & rhyme' },
  { id: 'highlight', label: 'Phrase', hint: 'Ctrl+3 — drag across subdivisions to highlight' },
]

export default function Toolbar(p: Props) {
  // What a new circle is actually filled with. Read from the song rather than
  // written out again, so the preview follows both the default and a palette
  // the user has edited.
  const newCircleFill = rhymeFill(p.song.palette, DEFAULT_COLOR)

  return (
    <header className="toolbar">
      <div className="row row-file">
        <span className="brand">FlowScript</span>

        <div className="group">
          <button onClick={p.onNew}>New</button>
          <button onClick={p.onOpen}>Open…</button>
          <button onClick={p.onSave}>Save</button>
          <button onClick={p.onSaveAs}>Save As…</button>
        </div>

        <div className="group">
          <button onClick={p.onUndo} disabled={!p.canUndo} title="Ctrl+Z">
            Undo
          </button>
          <button onClick={p.onRedo} disabled={!p.canRedo} title="Ctrl+Shift+Z">
            Redo
          </button>
        </div>

        <div className="group">
          <button onClick={p.onExportPNG}>Export PNG</button>
          <select
            value={p.exportScale}
            onChange={(e) => p.setExportScale(Number(e.target.value))}
            title="PNG resolution multiplier"
          >
            {[1, 2, 3, 4, 6, 8].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
          <button onClick={p.onExportSVG}>SVG</button>
          <button onClick={p.onCopyPNG} title="Copy the score to the clipboard as a PNG">
            Copy
          </button>
        </div>

        <div className="group">
          <label className="zoom">
            Zoom
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={p.zoom}
              onChange={(e) => p.setZoom(Number(e.target.value))}
            />
            <span className="mono">{Math.round(p.zoom * 100)}%</span>
          </label>
        </div>

        <div className="spacer" />
        <button onClick={p.onToggleSettings}>Song settings</button>
        <button onClick={p.onToggleColors}>Colors</button>
        <button onClick={p.onToggleHelp}>Keys ?</button>
        <span className="filename">
          {p.fileName ?? 'Untitled'}
          {p.dirty ? ' •' : ''}
        </span>
      </div>

      <div className="row row-tools">
        <div className="group modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={p.mode === m.id ? 'mode active' : 'mode'}
              onClick={() => p.setMode(m.id)}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
        </div>

        {p.mode === 'annotate' && (
          <>
            <div className="group">
              <span className="lbl">Stress</span>
              <button onClick={() => p.onSetCircle('large')} disabled={!p.hasCursor} title="A">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <circle cx="11" cy="11" r="8" fill={newCircleFill} stroke="#111" strokeWidth="1.5" />
                </svg>
              </button>
              <button onClick={() => p.onSetCircle('small')} disabled={!p.hasCursor} title="S">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <circle cx="11" cy="11" r="4.5" fill={newCircleFill} stroke="#111" strokeWidth="1.5" />
                </svg>
              </button>
              <button onClick={() => p.onSetCircle(null)} disabled={!p.hasCursor} title="D">
                none
              </button>
              <button onClick={p.onToggleTie} disabled={!p.hasCursor} title="Q — connect to next circle">
                tie
              </button>
            </div>

            <div className="group swatches">
              <span className="lbl">Rhyme</span>
              {p.song.palette.map((fill, i) => (
                <button
                  key={i}
                  className={p.rhymeColor === i ? 'swatch active' : 'swatch'}
                  style={{ background: fill }}
                  onClick={() => p.setRhymeColor(i)}
                  title={`${swatchLabel(p.song.palette, i, DEFAULT_PALETTE)} — ${COLOR_KEY_HINTS[i]}`}
                />
              ))}
              <button className="link" onClick={p.onToggleColors} title="Edit the color palettes">
                edit…
              </button>
            </div>

            {/* Second rhyme color. Its own row rather than a modifier on the row
                above, so it is something you can see and click rather than a
                keystroke you have to know about. The swatches are drawn striped
                because that is how the color reads on the score. */}
            <div className="group swatches">
              <span className="lbl" title="A second rhyme this syllable also belongs to">
                2nd
              </span>
              {p.song.palette.map((fill, i) => (
                <button
                  key={i}
                  className={p.rhymeColor2 === i ? 'swatch active2' : 'swatch'}
                  style={{
                    background: `repeating-linear-gradient(-45deg, ${fill} 0 4px, #fff 4px 8px)`,
                  }}
                  onClick={() => p.setRhymeColor2(i)}
                  title={`${swatchLabel(p.song.palette, i, DEFAULT_PALETTE)} as a second rhyme — Alt+${
                    COLOR_KEY_HINTS[i]
                  }. Click again to take it off.`}
                />
              ))}
              <button
                className="swatch erase"
                onClick={p.onClearSecondColor}
                disabled={p.rhymeColor2 === null}
                title="Back to one color on this circle"
              >
                ⌫
              </button>
            </div>
          </>
        )}

        {p.mode === 'highlight' && (
          <>
            <div className="group swatches">
              <span className="lbl">Phrase</span>
              {p.song.highlightPalette.map((fill, i) => (
                <button
                  key={i}
                  className={p.highlightColor === i ? 'swatch active' : 'swatch'}
                  style={{ background: fill }}
                  onClick={() => p.setHighlightColor(i)}
                  title={`${swatchLabel(p.song.highlightPalette, i, DEFAULT_HIGHLIGHTS)} — ${i + 1}`}
                />
              ))}
              <button
                className={p.highlightColor === 'erase' ? 'swatch erase active' : 'swatch erase'}
                onClick={() => p.setHighlightColor('erase')}
                title="Eraser — 0. Drag over highlights to remove them."
              >
                ⌫
              </button>
              <button className="link" onClick={p.onToggleColors} title="Edit the color palettes">
                edit…
              </button>
            </div>
            <div className="group">
              <button onClick={p.onDeleteHighlight} disabled={!p.selectedHighlight}>
                Delete highlight
              </button>
            </div>
          </>
        )}

        {/* The ruler and the bar list belong to the writing pass: you lay the
            grid out while typing the syllables onto it. Annotate and Phrase are
            passes over a grid that already exists, so they get their own rows
            back rather than carrying controls nobody reaches for there. */}
        {p.mode === 'text' && (
          <>
            <div className="group">
              <span className="lbl">Divide beat</span>
              {UNIFORM_DIVISIONS.map((d) => (
                <button
                  key={d}
                  className={p.currentDivision === d ? 'div active' : 'div'}
                  disabled={!p.hasCursor}
                  onClick={() => p.onSetDivision(d, 'beat')}
                  title={`Divide the current beat into ${d}`}
                >
                  {d}
                </button>
              ))}
              <span className="lbl sep">halves</span>
              {COMPOUND_DIVISIONS.map((d) => (
                <button
                  key={d}
                  className={p.currentDivision === d ? 'div active' : 'div'}
                  disabled={!p.hasCursor}
                  onClick={() => p.onSetDivision(d, 'beat')}
                  title={`Divide the first half of the beat into ${d[0]}, the second into ${d[2]}`}
                >
                  {d}
                </button>
              ))}
              <button
                disabled={!p.hasCursor}
                onClick={() => p.currentDivision && p.onSetDivision(p.currentDivision, 'bar')}
                title="Apply the current beat's division to the whole bar"
              >
                → bar
              </button>
              <button
                disabled={!p.hasCursor}
                onClick={() => p.currentDivision && p.onSetDivision(p.currentDivision, 'all')}
                title="Apply the current beat's division to every bar"
              >
                → all
              </button>
            </div>

            <div className="group">
              <span className="lbl">Bars</span>
              <button onClick={p.onAddBar} title="Ctrl+Enter">
                + end
              </button>
              <button onClick={p.onInsertBar} disabled={!p.hasCursor}>
                + here
              </button>
              <button onClick={p.onDuplicateBar} disabled={!p.hasCursor}>
                duplicate
              </button>
              <button onClick={p.onDeleteBar} disabled={!p.hasCursor || p.song.bars.length <= 1}>
                delete
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
