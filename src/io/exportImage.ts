/**
 * Image export.
 *
 * The score is one <svg> whose on-screen size already equals its export size at
 * zoom 1, so export is: clone the live SVG, strip editor-only chrome (cursor
 * ring, hit targets, selection outlines), then either hand back the SVG source
 * or rasterise it into a canvas at an arbitrary scale for a high-DPI PNG.
 *
 * Everything visual is set with presentation attributes rather than CSS classes
 * precisely so the clone renders standalone — an <img> loading a serialized SVG
 * gets no stylesheet from the host page.
 */

import { downloadBlob } from './persist'

function prepareClone(svg: SVGSVGElement): { clone: SVGSVGElement; width: number; height: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-editor-only]').forEach((n) => n.remove())
  // Inline styles only ever carry interaction affordances (cursor, user-select,
  // touch-action) — no appearance depends on them, so dropping them keeps the
  // exported file clean and small on long verses.
  clone.removeAttribute('style')
  clone.querySelectorAll('[style]').forEach((n) => n.removeAttribute('style'))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

  const width = Number(svg.getAttribute('width'))
  const height = Number(svg.getAttribute('height'))

  // Opaque background so PNGs don't come out with transparent paper.
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '0')
  bg.setAttribute('width', String(width))
  bg.setAttribute('height', String(height))
  bg.setAttribute('fill', '#FFFFFF')
  clone.insertBefore(bg, clone.firstChild)

  return { clone, width, height }
}

export function exportSVG(svg: SVGSVGElement, filename: string) {
  const { clone } = prepareClone(svg)
  const source = '<?xml version="1.0" standalone="no"?>\n' + new XMLSerializer().serializeToString(clone)
  downloadBlob(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

export async function exportPNG(svg: SVGSVGElement, scale: number, filename: string) {
  const { clone, width, height } = prepareClone(svg)
  const source = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not rasterise the score.'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG encoding failed.')
    downloadBlob(blob, filename)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function copyPNGToClipboard(svg: SVGSVGElement, scale: number): Promise<void> {
  const { clone, width, height } = prepareClone(svg)
  const source = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not rasterise the score.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG encoding failed.')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  } finally {
    URL.revokeObjectURL(url)
  }
}
