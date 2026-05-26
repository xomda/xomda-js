import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { sendFile } from './static'

const VENDOR_PREFIX = '/vendor/'
const MANIFEST_PUBLIC_PATH = '/vendor.manifest.json'

export type VendorHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

/**
 * Serves third-party packages externalized from the SPA bundle.
 *
 * The manifest is a JSON array of bare package specifiers (e.g.
 * `["lodash-es", "@vueuse/core"]`). Each package's on-disk root is resolved at
 * server startup via `createRequire(manifestPath)`, so the manifest stays
 * portable — only the consumer's `node_modules` layout matters, not the
 * builder's. The SPA's `<script type="importmap">` rewrites bare specifiers to
 * `/vendor/<pkg>/<deep-path>` URLs that this handler resolves back to files
 * inside each package root.
 *
 * Security: only paths inside a known package root are served. Path traversal
 * returns `false` (handler did not handle); requesting the manifest itself
 * returns 404.
 */
export function createVendorHandler(manifestPath: string): VendorHandler | undefined {
  if (!existsSync(manifestPath)) return undefined

  const names = parseManifest(manifestPath)
  const requireFromManifest = createRequire(pathToFileURL(manifestPath))

  const roots = new Map<string, string>()
  for (const pkg of names) {
    let pkgJson: string
    try {
      pkgJson = requireFromManifest.resolve(`${pkg}/package.json`)
    } catch (err) {
      throw new Error(
        `vendor manifest lists "${pkg}" but the package is not installed beside ${manifestPath}: ${(err as Error).message}`,
        { cause: err }
      )
    }
    roots.set(pkg, resolve(dirname(pkgJson)))
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

/**
 * Accepts the canonical array shape `["pkg-a", "pkg-b"]`. Also accepts the
 * legacy object shape `{ "pkg-a": "<ignored>" }` so a tarball built before
 * this fix still boots — only the keys are honored; baked-in absolute paths
 * are discarded in favor of runtime resolution.
 */
function parseManifest(manifestPath: string): string[] {
  const raw = readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
  if (parsed && typeof parsed === 'object') return Object.keys(parsed as Record<string, unknown>)
  throw new Error(`vendor manifest at ${manifestPath} is neither an array nor an object`)
}
