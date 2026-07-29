/**
 * Rhyme colors (circle fills) and phrase-structure highlight colors.
 *
 * The values below are only the *defaults*. The live palettes are stored on the
 * Song (`song.palette` / `song.highlightPalette`) so a file always reopens and
 * exports with the colors it was made with. The document references colors by
 * index, so the palette lengths are fixed — editing a swatch re-tints every
 * circle already using it, which is the intended behaviour.
 *
 * A team can pin their preferred scheme as the default for new songs; that
 * preference lives in localStorage and never travels with a file.
 */

export interface Swatch {
  name: string
  fill: string
}

/** Index 0 is the color every new circle gets. */
export const DEFAULT_COLOR = 0

export const DEFAULT_PALETTE: Swatch[] = [
  { name: 'Grey', fill: '#C9C9C9' },
  { name: 'Yellow', fill: '#FFE44D' },
  { name: 'Green', fill: '#9BE89B' },
  { name: 'Cyan', fill: '#7FE3F0' },
  { name: 'Pink', fill: '#FFA6C9' },
  { name: 'Orange', fill: '#FFB870' },
  { name: 'Violet', fill: '#C3A6FF' },
  { name: 'Lime', fill: '#C6EB5C' },
  { name: 'Coral', fill: '#FF8A80' },
  { name: 'Sky', fill: '#8FB8FF' },
  { name: 'Mint', fill: '#7FE0C4' },
  { name: 'Peach', fill: '#FFCBA4' },
  { name: 'Magenta', fill: '#F09BE0' },
  { name: 'Olive', fill: '#C8C87A' },
  { name: 'Tan', fill: '#D9BE93' },
  { name: 'White', fill: '#FFFFFF' },
]

export const DEFAULT_HIGHLIGHTS: Swatch[] = [
  { name: 'Pink', fill: '#FBD9D9' },
  { name: 'Orange', fill: '#FBDCC0' },
  { name: 'Yellow', fill: '#FBF3C4' },
  { name: 'Green', fill: '#D8ECD8' },
  { name: 'Teal', fill: '#D0EDE9' },
  { name: 'Blue', fill: '#D6E4F7' },
  { name: 'Violet', fill: '#E4DAF5' },
  { name: 'Grey', fill: '#E6E6E6' },
]

export const PALETTE_SIZE = DEFAULT_PALETTE.length
export const HIGHLIGHT_SIZE = DEFAULT_HIGHLIGHTS.length

export const defaultPalette = (): string[] => DEFAULT_PALETTE.map((s) => s.fill)
export const defaultHighlightPalette = (): string[] => DEFAULT_HIGHLIGHTS.map((s) => s.fill)

/** Keyboard order for rhyme colors: backtick, 1-9, 0, then Shift+1..Shift+5. */
export const COLOR_KEY_HINTS = [
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '0', '!', '@', '#', '$', '%',
]

/* ------------------------------------------------------------------ */
/* Color values                                                       */
/* ------------------------------------------------------------------ */

/** Accepts `#rgb`, `#rrggbb`, with or without the hash. Returns `#RRGGBB`. */
export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim())
  if (!m) return fallback
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `#${hex.toUpperCase()}`
}

export const isHex = (value: string) => /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())

/** Force an arbitrary stored value into a palette of exactly `defaults.length`. */
export function coercePalette(raw: unknown, defaults: Swatch[]): string[] {
  const arr = Array.isArray(raw) ? raw : []
  return defaults.map((d, i) => normalizeHex(arr[i], d.fill))
}

export const rhymeFill = (palette: string[], index: number | undefined) =>
  palette[index ?? DEFAULT_COLOR] ?? DEFAULT_PALETTE[DEFAULT_COLOR].fill

export const phraseFill = (palette: string[], index: number) =>
  palette[index] ?? DEFAULT_HIGHLIGHTS[0].fill

/**
 * Readable label for a swatch: the default's name while it still holds its
 * default value, otherwise the hex the user chose.
 */
export function swatchLabel(palette: string[], index: number, defaults: Swatch[]): string {
  const fill = palette[index] ?? defaults[index]?.fill ?? ''
  const def = defaults[index]
  return def && fill.toUpperCase() === def.fill.toUpperCase() ? def.name : fill
}

/* ------------------------------------------------------------------ */
/* Team default, remembered across songs                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'flowscript.defaultPalettes.v1'
/** The app was called Beat Ruler; read the old key so saved schemes survive. */
const LEGACY_STORAGE_KEY = 'beatruler.defaultPalettes.v1'

export interface StoredPalettes {
  palette: string[]
  highlightPalette: string[]
}

export function loadStoredPalettes(): StoredPalettes | null {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      palette: coercePalette(parsed?.palette, DEFAULT_PALETTE),
      highlightPalette: coercePalette(parsed?.highlightPalette, DEFAULT_HIGHLIGHTS),
    }
  } catch {
    // Storage can be unavailable (private mode, disabled); defaults are fine.
    return null
  }
}

export function storeDefaultPalettes(p: StoredPalettes): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function clearStoredPalettes(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    // Otherwise the legacy value would resurface on the next load.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
