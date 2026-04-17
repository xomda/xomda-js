import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve, sep } from 'node:path'

import { sendFile } from './static'

const VENDOR_PREFIX = '/vendor/'
const MANIFEST_PUBLIC_PATH = '/vendor.manifest.json'

export type VendorHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

/**
 * Serves third-party packages externalized from the SPA bundle.
 *
 * The manifest maps a bare package specifier (e.g. `"vue"`, `"@vueuse/core"`) to the
 * absolute path of that package's directory inside the running install's
 * `node_modules`. The SPA's `<script type="importmap">` rewrites bare specifiers to
 * `/vendor/<pkg>/<deep-path>` URLs that this handler resolves back to on-disk files.
 *
 * Security: only paths inside a known package root are served. Path traversal returns
 * `false` (handler did not handle); requesting the manifest itself returns 404.
 */
export function createVendorHandler(manifestPath: string): VendorHandler | undefined {
  if (!existsSync(manifestPath)) return undefined

  const raw = readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(raw) as Record<string, string>

  const roots = new Map<string, string>()
  for (const [pkg, dir] of Object.entries(parsed)) {
    roots.set(pkg, resolve(dir))
  }

  const sortedKeys = [...roots.keys()].sort((a, b) => b.length - a.length)

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false

    const url = req.url ?? '/'
    const pathname = url.split('?')[0] ?? '/'

    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return false
    }

    if (decoded === MANIFEST_PUBLIC_PATH) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return true
    }

    if (!decoded.startsWith(VENDOR_PREFIX)) return false

    const rest = decoded.slice(VENDOR_PREFIX.length)
    const matchedKey = sortedKeys.find((k) => rest === k || rest.startsWith(`${k}/`))
    if (!matchedKey) return false

    const root = roots.get(matchedKey)!
    const subpath = rest === matchedKey ? '' : rest.slice(matchedKey.length + 1)
    const target = resolve(root, subpath)

    if (target !== root && !target.startsWith(root + sep)) return false

    try {
      const stat = await fsp.stat(target)
      if (stat.isFile()) {
        await sendFile(req, res, target)
        return true
      }
    } catch {
      // fall through to 404
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return true
  }
}
