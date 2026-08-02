/**
 * Song-level settings: the header caption line, bar geometry, and typography.
 * Changing beatsPerBar re-shapes every bar's division array, so it goes through
 * a dedicated callback rather than a raw patch.
 */

import {
  clampBeatWidth,
  clampRowGap,
  clampLyricSize,
  DIVISIONS,
  MAX_BEAT_WIDTH,
  MAX_ROW_GAP,
  MAX_LYRIC_SIZE,
  MIN_BEAT_WIDTH,
  MIN_ROW_GAP,
  MIN_LYRIC_SIZE,
  parseDivision,
  type Song,
  type SongHeader,
} from '../model'

interface Props {
  song: Song
  onHeader: (patch: Partial<SongHeader>) => void
  onPatch: (
    patch: Partial<Pick<Song, 'startBar' | 'ruler' | 'font' | 'defaultDivision' | 'lyricSize' | 'beatWidth' | 'rowGap' | 'rulerLabel'>>,
  ) => void
  onBeatsPerBar: (n: number) => void
  onClose: () => void
}

export default function SettingsPanel({ song, onHeader, onPatch, onBeatsPerBar, onClose }: Props) {
  return (
    <aside className="panel">
      <div className="panel-head">
        <strong>Song settings</strong>
        <button onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        <h4>Caption</h4>
        <label>
          Verse
          <input
            value={song.header.verse}
            placeholder="Verse 2"
            onChange={(e) => onHeader({ verse: e.target.value })}
          />
        </label>
        <label>
          Title
          <input
            value={song.header.title}
            placeholder="Song Title"
            onChange={(e) => onHeader({ title: e.target.value })}
          />
        </label>
        <label>
          Artist
          <input
            value={song.header.artist}
            placeholder="Artist"
            onChange={(e) => onHeader({ artist: e.target.value })}
          />
        </label>
        <label>
          Year
          <input
            value={song.header.year}
            placeholder="1994"
            onChange={(e) => onHeader({ year: e.target.value })}
          />
        </label>
        <label>
          Time-stamp
          <input
            value={song.header.timestamp}
            placeholder="1:04"
            onChange={(e) => onHeader({ timestamp: e.target.value })}
          />
        </label>

        <h4>Ruler</h4>
        <label>
          Beats per bar
          <input
            type="number"
            min={1}
            max={16}
            value={song.beatsPerBar}
            onChange={(e) => onBeatsPerBar(Number(e.target.value))}
          />
        </label>
        <label>
          First bar number
          <input
            type="number"
            value={song.startBar}
            onChange={(e) => onPatch({ startBar: Math.round(Number(e.target.value) || 0) })}
          />
        </label>
        <label>
          Default division
          <select
            value={song.defaultDivision}
            // Not Number(): a compound division's value is "3+2", which would
            // come back NaN and wipe the setting.
            onChange={(e) => onPatch({ defaultDivision: parseDivision(e.target.value) })}
          >
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Beat width
          <span className="size-field">
            <input
              type="range"
              min={MIN_BEAT_WIDTH}
              max={MAX_BEAT_WIDTH}
              step={5}
              value={song.beatWidth}
              onChange={(e) => onPatch({ beatWidth: clampBeatWidth(e.target.value) })}
            />
            <input
              type="number"
              min={MIN_BEAT_WIDTH}
              max={MAX_BEAT_WIDTH}
              value={song.beatWidth}
              onChange={(e) => onPatch({ beatWidth: clampBeatWidth(e.target.value) })}
            />
          </span>
        </label>
        <label>
          Beat vertical padding
          <span className="size-field">
            <input
              type="range"
              min={MIN_ROW_GAP}
              max={MAX_ROW_GAP}
              step={2}
              value={song.rowGap}
              onChange={(e) => onPatch({ rowGap: clampRowGap(e.target.value) })}
            />
            <input
              type="number"
              min={MIN_ROW_GAP}
              max={MAX_ROW_GAP}
              value={song.rowGap}
              onChange={(e) => onPatch({ rowGap: clampRowGap(e.target.value) })}
            />
          </span>
        </label>
        <label>
          Top ruler
          <select value={song.ruler} onChange={(e) => onPatch({ ruler: e.target.value as Song['ruler'] })}>
            <option value="beats">Beat numbers</option>
            <option value="index">Subdivision index (0–15)</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="check">
          <span>Show the word “beat”</span>
          <input
            type="checkbox"
            checked={song.rulerLabel}
            disabled={song.ruler !== 'beats'}
            onChange={(e) => onPatch({ rulerLabel: e.target.checked })}
          />
        </label>

        <h4>Type</h4>
        <label>
          Lyric font
          <select value={song.font} onChange={(e) => onPatch({ font: e.target.value as Song['font'] })}>
            <option value="sans">Sans</option>
            <option value="serif">Serif italic</option>
          </select>
        </label>
        <label>
          Lyric size
          <span className="size-field">
            <input
              type="range"
              min={MIN_LYRIC_SIZE}
              max={MAX_LYRIC_SIZE}
              step={1}
              value={song.lyricSize}
              onChange={(e) => onPatch({ lyricSize: clampLyricSize(e.target.value) })}
            />
            <input
              type="number"
              min={MIN_LYRIC_SIZE}
              max={MAX_LYRIC_SIZE}
              value={song.lyricSize}
              onChange={(e) => onPatch({ lyricSize: clampLyricSize(e.target.value) })}
            />
          </span>
        </label>

        <p className="note">
          New bars use the default division. Changing beats per bar keeps existing annotations that
          still fit and drops any that fall outside the new bar length.
        </p>
      </div>
    </aside>
  )
}
