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

/**
 * The first eleven are the pastels a solid circle wants: light enough that the
 * black outline and the syllable beneath stay the strongest marks on the row.
 *
 * The four before White are deliberately **dark**. A two-color circle stripes
 * one of these against another, and a palette of pastels alone cannot do that —
 * every pair in the all-pastel scheme this replaced sat between 1.0:1 and
 * 2.3:1 contrast, so the stripes read as a single muddy tint rather than as two
 * rhymes. Each of these clears 3.5:1 against every light color (2.3:1 against
 * Coral, the lightest-but-one), which is what makes the stripe legible.
 *
 * They are dark relative to the pastels, not to each other: striping two darks
 * together still reads poorly, and hue is all that separates them there. The
 * self-test pins the count and the worst-case pairing so a future palette edit
 * cannot quietly return the scheme to all-pastel.
 */
export const DEFAULT_PALETTE: Swatch[] = [
  { name: 'Grey', fill: '#E0E0E0' },
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
  { name: 'Indigo', fill: '#2F4B9B' },
  { name: 'Crimson', fill: '#B02A37' },
  { name: 'Forest', fill: '#1F7A4D' },
  { name: 'Plum', fill: '#6D3B8E' },
  // Kept last: a white circle is the one "outline only" mark, which no dark
  // color can stand in for.
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

/** The `e.code` + shift state that produces each hint character. */
const SHIFTED_DIGITS: Record<string, string> = {
  '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5',
}
const COLOR_KEY_CODES = COLOR_KEY_HINTS.map((hint) => {
  if (hint === '`') return { code: 'Backquote', shift: false }
  if (/^[0-9]$/.test(hint)) return { code: `Digit${hint}`, shift: false }
  const shifted = SHIFTED_DIGITS[hint]
  return shifted ? { code: shifted, shift: true } : null
})

/**
 * The palette index a key event stands for, or -1.
 *
 * The second-color binding holds Alt, and `e.key` is unusable then — macOS
 * turns ⌥1 into "¡" — so it matches on `e.code`. Derived from COLOR_KEY_HINTS
 * rather than written out again, so the help text, the plain binding and the
 * Alt binding cannot drift apart.
 *
 * `code` is empty on some input paths that do not come from real key hardware
 * (remote desktops, on-screen keyboards, synthetic events). The hint characters
 * are unambiguous on their own, so those fall back to `key`.
 */
export function colorIndexForKey(code: string, key: string, shift: boolean): number {
  if (!code) return COLOR_KEY_HINTS.indexOf(key)
  return COLOR_KEY_CODES.findIndex((k) => k !== null && k.code === code && k.shift === shift)
}

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
