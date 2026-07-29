/**
 * Song state with undo/redo.
 *
 * The document is small (a long verse is a few hundred slots), so history is
 * plain snapshots rather than diffs. `update` coalesces consecutive edits that
 * share a `mergeKey` — typing a syllable produces one undo step, not one per
 * keystroke.
 */

import { useCallback, useRef, useState } from 'react'
import { coerceSong, newSong, type Song } from './model'

const HISTORY_LIMIT = 200

export interface SongApi {
  song: Song
  /** Apply a mutation to a draft copy of the song. */
  update: (fn: (draft: Song) => void, mergeKey?: string) => void
  /** Replace the whole document (load / new). Clears history. */
  reset: (song: Song) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Bumped on every structural change; used to flag unsaved work. */
  revision: number
}

const clone = (s: Song): Song =>
  typeof structuredClone === 'function' ? structuredClone(s) : (JSON.parse(JSON.stringify(s)) as Song)

export function useSong(initial?: Song): SongApi {
  const [song, setSong] = useState<Song>(() => initial ?? newSong())
  const [revision, setRevision] = useState(0)
  const past = useRef<Song[]>([])
  const future = useRef<Song[]>([])
  const lastMergeKey = useRef<string | null>(null)

  const update = useCallback((fn: (draft: Song) => void, mergeKey?: string) => {
    setSong((current) => {
      const draft = clone(current)
      fn(draft)

      const merging = mergeKey != null && mergeKey === lastMergeKey.current && past.current.length > 0
      if (!merging) {
        past.current.push(current)
        if (past.current.length > HISTORY_LIMIT) past.current.shift()
      }
      lastMergeKey.current = mergeKey ?? null
      future.current = []
      return draft
    })
    setRevision((r) => r + 1)
  }, [])

  const reset = useCallback((next: Song) => {
    past.current = []
    future.current = []
    lastMergeKey.current = null
    setSong(coerceSong(next))
    setRevision(0)
  }, [])

  const undo = useCallback(() => {
    setSong((current) => {
      const prev = past.current.pop()
      if (!prev) return current
      future.current.push(current)
      lastMergeKey.current = null
      return prev
    })
    setRevision((r) => r + 1)
  }, [])

  const redo = useCallback(() => {
    setSong((current) => {
      const next = future.current.pop()
      if (!next) return current
      past.current.push(current)
      lastMergeKey.current = null
      return next
    })
    setRevision((r) => r + 1)
  }, [])

  return {
    song,
    update,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  }
}
