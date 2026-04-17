import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

/**
 * Baseline file-type contributions for common binaries. This plugin has
 * no `detect` and no `patterns` — it never appears as a "detected
 * feature" or a homepage chip. It exists purely so `fileTypesFor(path)`
 * can route a .png to the image preview, a .zip to HexView, etc.,
 * even when no other plugin claims the file.
 *
 * Image extensions (kind: 'image'): png, jpg, jpeg, gif, webp, bmp, ico, svg.
 * Binary extensions (kind: 'binary'): pdf, zip, jar, war, gz, tgz, tar,
 *   7z, rar, bz2, xz, exe, dll, so, dylib, class, o, a, woff, woff2,
 *   ttf, otf, eot, mp3, wav, ogg, flac, m4a, aac, mp4, mov, avi, mkv,
 *   webm, wasm, db, sqlite, sqlite3, ico (overlap with image — image wins
 *   via priority).
 *
 * The priority is intentionally low (1) so technology plugins that claim
 * the same path (e.g. an ESLint config that also happens to be a `.js`
 * file) win preview routing.
 */
export const binaryPlugin: AnalysisPlugin = {
  id: 'binary',
  name: 'Binary files',
  fileTypes: [
    {
      id: 'image',
      label: 'Image',
      match: { extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'] },
      preview: { kind: 'image' },
      priority: 1,
    },
    {
      id: 'svg',
      // SVG is text but visually it's an image — render as image so the
      // file browser shows the picture, not the markup.
      label: 'SVG',
      match: { extensions: ['svg'] },
      preview: { kind: 'image' },
      priority: 1,
    },
    {
      id: 'pdf',
      label: 'PDF',
      match: { extensions: ['pdf'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'archive',
      label: 'Archive',
      match: {
        extensions: ['zip', 'jar', 'war', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2', 'xz'],
      },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'native',
      label: 'Native binary',
      match: { extensions: ['exe', 'dll', 'so', 'dylib', 'class', 'o', 'a', 'wasm'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'font',
      label: 'Font',
      match: { extensions: ['woff', 'woff2', 'ttf', 'otf', 'eot'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'audio',
      label: 'Audio',
      match: { extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'video',
      label: 'Video',
      match: { extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
    {
      id: 'database',
      label: 'Database',
      match: { extensions: ['db', 'sqlite', 'sqlite3'] },
      preview: { kind: 'binary' },
      priority: 1,
    },
  ],
}

registerAnalysisPlugin(binaryPlugin)
