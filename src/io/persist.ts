/**
 * Local save/load. One .flowscript.json file = one song.
 *
 * Songs saved under the old `.beatruler.json` name still open: the picker
 * filters on `.json`, and `coerceSong` never inspects the filename.
 *
 * Uses the File System Access API when the browser has it (Chrome/Edge), which
 * gives a real "Save" that overwrites the file in place. Everything else falls
 * back to a download + file-input round trip.
 */

import { coerceSong, type Song } from '../model'

export const FILE_EXT = '.flowscript.json'

type FileHandleLike = {
  name: string
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
  getFile: () => Promise<File>
}

const w = window as unknown as {
  showSaveFilePicker?: (opts: unknown) => Promise<FileHandleLike>
  showOpenFilePicker?: (opts: unknown) => Promise<FileHandleLike[]>
}

export const hasFsAccess = typeof w.showSaveFilePicker === 'function'

const pickerTypes = [
  { description: 'FlowScript song', accept: { 'application/json': ['.json'] } },
]

export function serialize(song: Song): string {
  return JSON.stringify(song, null, 2)
}

export function suggestedName(song: Song): string {
  const base =
    [song.header.title, song.header.verse].filter((s) => s.trim()).join(' - ').trim() || 'untitled'
  return base.replace(/[^\w\-. ]+/g, '').slice(0, 60) + FILE_EXT
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Save to an existing handle, or fall back to Save As. Returns the handle used. */
export async function saveSong(
  song: Song,
  handle: FileHandleLike | null,
): Promise<FileHandleLike | null> {
  const data = serialize(song)
  if (handle) {
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
    return handle
  }
  return saveSongAs(song)
}

export async function saveSongAs(song: Song): Promise<FileHandleLike | null> {
  const data = serialize(song)
  const name = suggestedName(song)
  if (w.showSaveFilePicker) {
    const h = await w.showSaveFilePicker({ suggestedName: name, types: pickerTypes })
    const writable = await h.createWritable()
    await writable.write(data)
    await writable.close()
    return h
  }
  downloadBlob(new Blob([data], { type: 'application/json' }), name)
  return null
}

export interface OpenResult {
  song: Song
  handle: FileHandleLike | null
  name: string
}

export async function openSong(): Promise<OpenResult | null> {
  if (w.showOpenFilePicker) {
    const [h] = await w.showOpenFilePicker({ types: pickerTypes, multiple: false })
    if (!h) return null
    const file = await h.getFile()
    return { song: coerceSong(JSON.parse(await file.text())), handle: h, name: file.name }
  }
  return new Promise<OpenResult | null>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        resolve({ song: coerceSong(JSON.parse(await file.text())), handle: null, name: file.name })
      } catch (err) {
        reject(err)
      }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
