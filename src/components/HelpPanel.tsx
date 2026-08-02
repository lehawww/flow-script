import { COLOR_KEY_HINTS, DEFAULT_PALETTE, swatchLabel } from '../palette'

const SECTIONS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Modes',
    keys: [
      ['Ctrl/⌘ 1', 'Text mode — type syllables'],
      ['Ctrl/⌘ 2', 'Annotate mode — stress + rhyme'],
      ['Ctrl/⌘ 3', 'Phrase mode — drag to highlight'],
      ['Esc', 'Text → Annotate'],
    ],
  },
  {
    title: 'Moving',
    keys: [
      ['← →', 'Previous / next slot'],
      ['↑ ↓', 'Same position, previous / next bar'],
      ['Home / End', 'First / last slot of the bar'],
      ['Tab / ⇧Tab', 'Next / previous slot'],
    ],
  },
  {
    title: 'Text mode',
    keys: [
      ['type', 'Enter the syllable at the cursor'],
      ['Space', 'Commit and advance'],
      ['Enter', 'Commit and drop to the next bar'],
      ['Backspace', 'On an empty slot, step back'],
      ['drag a syllable', 'Nudge it off centre'],
    ],
  },
  {
    title: 'Annotate mode',
    keys: [
      ['A', 'Large circle (stressed) + advance'],
      ['S', 'Small circle (unstressed) + advance'],
      ['D', 'Clear the circle + advance'],
      ['⇧A / ⇧S / ⇧D', 'Same, without advancing'],
      ['Q', 'Toggle rhyme tie to the next circle'],
      ['1…0 / ⇧1…5', 'Rhyme color — one solid color'],
      ['Alt + the same key', 'Add it as a second rhyme (stripes); again removes it'],
      ['Space', 'Advance'],
      ['Backspace', 'Clear circle, color and text'],
    ],
  },
  {
    title: 'Phrase mode',
    keys: [
      ['drag', 'Highlight a range of subdivisions (spans bars)'],
      ['click', 'Select an existing highlight'],
      ['1–8', 'Pick the highlight color'],
      ['0', 'Eraser — drag over highlights to remove'],
      ['Delete', 'Remove the selected highlight'],
    ],
  },
  {
    title: 'File',
    keys: [
      ['Ctrl/⌘ S', 'Save'],
      ['Ctrl/⌘ ⇧ S', 'Save As'],
      ['Ctrl/⌘ O', 'Open'],
      ['Ctrl/⌘ E', 'Export PNG'],
      ['Ctrl/⌘ Z', 'Undo'],
      ['Ctrl/⌘ ⇧ Z', 'Redo'],
      ['Ctrl/⌘ Enter', 'Add a bar at the end'],
    ],
  },
]

export default function HelpPanel({
  palette,
  onClose,
}: {
  palette: string[]
  onClose: () => void
}) {
  return (
    <aside className="panel">
      <div className="panel-head">
        <strong>Keyboard</strong>
        <button onClick={onClose}>×</button>
      </div>
      <div className="panel-body">
        {SECTIONS.map((s) => (
          <div key={s.title} className="help-section">
            <h4>{s.title}</h4>
            <table>
              <tbody>
                {s.keys.map(([k, d]) => (
                  <tr key={k}>
                    <td className="kbd">{k}</td>
                    <td>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="help-section">
          <h4>Rhyme colors (Annotate mode)</h4>
          <div className="key-swatches">
            {palette.map((fill, i) => (
              <span key={i} title={swatchLabel(palette, i, DEFAULT_PALETTE)}>
                <i style={{ background: fill }} />
                <b>{COLOR_KEY_HINTS[i]}</b>
              </span>
            ))}
          </div>
          <p className="note">
            Colors 12–16 are Shift + 1…5. Backtick resets a circle to the default grey. Applying a
            color to a slot with no circle gives it a large one.
          </p>
          <p className="note">
            The <b>2nd</b> row in the toolbar — or <b>Alt</b> (⌥) with any of those keys — adds a{' '}
            <b>second</b> rhyme color, drawn as diagonal stripes over the first. That's for a
            syllable two rhymes share: in “drop it in the pocket”, <i>drop</i> and <i>it</i> belong
            both to the earlier rhyme and to the new multi built on <i>pock-et</i>. Picking the same
            color again takes it off, as does ⌫ on that row; a plain color key sets one solid color.
          </p>
        </div>
      </div>
    </aside>
  )
}
