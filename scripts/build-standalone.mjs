/**
 * Folds the Vite build into one self-contained .html file.
 *
 * Why: the normal build emits `<script type="module" crossorigin src="...">`,
 * and a module script with a `src` is a cross-origin fetch. Opened from
 * `file://` the page's origin is `null`, so that fetch is blocked and the app
 * never boots — double-clicking the file would show a blank page.
 *
 * Inlining the script and stylesheet removes every subresource request, so
 * there is nothing left to block. The result is one file you can email or drop
 * on a shared drive, and a non-technical user just opens it.
 *
 * Run after `vite build`: `npm run build:standalone`.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const outDir = join(root, 'standalone')
const outFile = join(outDir, 'FlowScript.html')

/** `</script>` inside a JS string would close the host tag; neuter it. */
const safeForInlineScript = (js) => js.replaceAll('</script', '<\\/script')

async function main() {
  let html
  try {
    html = await readFile(join(dist, 'index.html'), 'utf8')
  } catch {
    console.error('No dist/index.html — run `npm run build` first.')
    process.exit(1)
  }

  const assets = await readdir(join(dist, 'assets'))
  const jsName = assets.find((f) => f.endsWith('.js'))
  const cssName = assets.find((f) => f.endsWith('.css'))
  if (!jsName) {
    console.error('No JS bundle found in dist/assets.')
    process.exit(1)
  }

  const js = await readFile(join(dist, 'assets', jsName), 'utf8')
  const css = cssName ? await readFile(join(dist, 'assets', cssName), 'utf8') : ''

  // Replacer *functions*, not strings: a bundle almost always contains `$&` or
  // `$1`, which String.replace would expand — silently re-injecting the very
  // tag being replaced.
  html = html.replace(
    /<script[^>]*src="[^"]*"[^>]*><\/script>/,
    () => `<script type="module">\n${safeForInlineScript(js)}\n</script>`,
  )
  html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () =>
    css ? `<style>\n${css}\n</style>` : '',
  )

  // Anything still pointing at ./assets would 404 from a single file.
  const leftovers = html.match(/(?:src|href)="\.?\/?assets\/[^"]*"/g)
  if (leftovers) {
    console.error(`Un-inlined references remain: ${leftovers.join(', ')}`)
    process.exit(1)
  }

  await mkdir(outDir, { recursive: true })
  await writeFile(outFile, html, 'utf8')
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0)
  console.log(`standalone/FlowScript.html  ${kb} kB  (single file, no external assets)`)
}

await main()
