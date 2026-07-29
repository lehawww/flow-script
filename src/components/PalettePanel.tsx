/**
 * Color editor for both palettes.
 *
 * Colors belong to the song, so edits here re-tint every circle or highlight
 * already using that index — that is the point, it lets a whole verse be
 * recolored at once. The lengths are fixed because the document stores color
 * indices, not values.
 */

import { useState } from 'react'
import {
  COLOR_KEY_HINTS,
  DEFAULT_HIGHLIGHTS,
  DEFAULT_PALETTE,
  defaultHighlightPalette,
  defaultPalette,
  isHex,
  normalizeHex,
  type Swatch,
} from '../palette'

interface Props {
  palette: string[]
  highlightPalette: string[]
  onChange: (patch: { palette?: string[]; highlightPalette?: string[] }) => void
  onSaveAsDefault: () => void
  onLoadSavedDefault: () => void
  onForgetSavedDefault: () => void
  hasSavedDefault: boolean
  onClose: () => void
}

interface RowsProps {
  values: string[]
  defaults: Swatch[]
  hints?: string[]
  onSet: (index: number, hex: string) => void
}

function SwatchRows({ values, defaults, hints, onSet }: RowsProps) {
  // Free-typing a hex needs a buffer: "#F" is not yet a color, but the user is
  // mid-way through typing it and the field must not fight them.
  const [draft, setDraft] = useState<Record<number, string>>({})

  return (
    <div className="swatch-rows">
      {values.map((fill, i) => {
        const text = draft[i] ?? fill
        const valid = isHex(text)
        return (
          <div className="swatch-row" key={i}>
            {hints ? <kbd>{hints[i]}</kbd> : <kbd className="muted">{i + 1}</kbd>}
            <input
              type="color"
              value={fill}
              aria-label={`Color ${i + 1}`}
              onChange={(e) => {
                setDraft((d) => ({ ...d, [i]: e.target.value.toUpperCase() }))
                onSet(i, e.target.value)
              }}
            />
            <input
              className={valid ? 'hex' : 'hex bad'}
              value={text}
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value
                setDraft((d) => ({ ...d, [i]: v }))
                if (isHex(v)) onSet(i, v)
              }}
              onBlur={() =>
                setDraft((d) => {
                  const { [i]: _drop, ...rest } = d
                  return rest
                })
              }
            />
            <button
              className="link"
              title={`Reset to ${defaults[i].name}`}
              disabled={fill.toUpperCase() === defaults[i].fill.toUpperCase()}
              onClick={() => {
                setDraft((d) => ({ ...d, [i]: defaults[i].fill }))
                onSet(i, defaults[i].fill)
              }}
            >
              ↺
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function PalettePanel(p: Props) {
  const setRhyme = (index: number, hex: string) => {
    const next = [...p.palette]
    next[index] = normalizeHex(hex, next[index])
    p.onChange({ palette: next })
  }

  const setPhrase = (index: number, hex: string) => {
    const next = [...p.highlightPalette]
    next[index] = normalizeHex(hex, next[index])
    p.onChange({ highlightPalette: next })
  }

  return (
    <aside className="panel">
      <div className="panel-head">
        <strong>Colors</strong>
        <button onClick={p.onClose}>×</button>
      </div>

      <div className="panel-body">
        <h4>Rhyme circles</h4>
        <SwatchRows
          values={p.palette}
          defaults={DEFAULT_PALETTE}
          hints={COLOR_KEY_HINTS}
          onSet={setRhyme}
        />

        <h4>Phrase highlights</h4>
        <SwatchRows values={p.highlightPalette} defaults={DEFAULT_HIGHLIGHTS} onSet={setPhrase} />

        <h4>Apply to</h4>
        <div className="palette-actions">
          <button onClick={p.onSaveAsDefault}>Save as default for new songs</button>
          <button onClick={p.onLoadSavedDefault} disabled={!p.hasSavedDefault}>
            Use saved default
          </button>
          <button
            onClick={() =>
              p.onChange({
                palette: defaultPalette(),
                highlightPalette: defaultHighlightPalette(),
              })
            }
          >
            Reset to built-in colors
          </button>
          <button onClick={p.onForgetSavedDefault} disabled={!p.hasSavedDefault}>
            Forget saved default
          </button>
        </div>

        <p className="note">
          Colors are saved inside the song file, so it always reopens and exports the way you made
          it. Changing a swatch re-tints everything already using it. The saved default applies to
          new songs only and stays on this machine.
        </p>
      </div>
    </aside>
  )
}
