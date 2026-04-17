import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from '@xomda/model/router'

import { createStaticHandler } from './static'
import { createVendorHandler } from './vendor'

const TRPC_PREFIX_RE = /^\/trpc(\/|\?|$)/

/**
 * Dev-server allow-list. The published binary serves the SPA same-origin and
 * sets `corsOrigins: []` — no `Access-Control-Allow-Origin` header is emitted
 * in that mode. `pnpm dev` runs Vite on :5173 and tRPC here on :6431, so the
 * single legitimate dev origin needs an opt-in entry.
 */
const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

export interface HttpServerOptions {
  staticDir?: string
  vendorManifestPath?: string
  /**
   * Origins allowed to make CORS requests against this server. Empty array
   * (the default in publish-mode where `staticDir` is set) disables CORS
   * entirely. Without this allow-list, `fileRouter.read` / `list` / `getStats`
   * would be reachable from any third-party page the user happens to visit
   * while the server is running — direct exfiltration of `.env`, ssh keys
   * under cwd, etc. `*` is never accepted.
   */
  corsOrigins?: readonly string[]
}

export function createHttpServer(port?: number, options: HttpServerOptions = {}) {
  const staticHandler = options.staticDir ? createStaticHandler(options.staticDir) : undefined
  const vendorHandler = options.vendorManifestPath
    ? createVendorHandler(options.vendorManifestPath)
    : undefined

  // Publish-mode (staticDir set) serves the SPA same-origin: no CORS needed.
  // Dev-mode (no staticDir) defaults to the Vite dev port allow-list.
  // Caller may override either way; explicit `[]` opts out everywhere.
  const corsOrigins = new Set(
    options.corsOrigins ?? (options.staticDir ? [] : DEFAULT_DEV_CORS_ORIGINS)
  )

  const server = createHTTPServer({
    router: appRouter,
    basePath: '/trpc/',
    createContext: () => ({}),
    async middleware(req, res, next) {
      const origin = req.headers.origin
      if (corsOrigins.size > 0) {
        // `Vary: Origin` is required whenever the response varies on Origin
        // so that intermediaries don't cache one client's CORS verdict for
        // another. tRPC's adapter sets its own Vary value (`trpc-accept,
        // accept`) AFTER our middleware returns; intercept setHeader for the
        // Vary case so both sets of tokens survive.
        const origSetHeader = res.setHeader.bind(res)
        res.setHeader = ((name: string, value: number | string | readonly string[]) => {
          if (String(name).toLowerCase() === 'vary' && typeof value === 'string') {
            const tokens = new Set(
              value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
            tokens.add('Origin')
            return origSetHeader('Vary', Array.from(tokens).join(', '))
          }
          return origSetHeader(name, value)
        }) as typeof res.setHeader
        res.setHeader('Vary', 'Origin')
        if (typeof origin === 'string' && corsOrigins.has(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin)
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'content-type,trpc-accept,trpc-batch-mode')
        }
      }
      if (req.method === 'OPTIONS') {
        // Preflight: succeed only when the origin is allow-listed. Disallowed
        // origins get a 403 instead of a 204 with no Allow-Origin header
        // (browsers treat both as failure; 403 makes server-side debugging
        // honest).
        if (corsOrigins.size === 0 || typeof origin !== 'string' || !corsOrigins.has(origin)) {
          res.writeHead(403)
          res.end()
          return
        }
        res.writeHead(204)
        res.end()
        return
      }

      if (req.url && TRPC_PREFIX_RE.test(req.url)) {
        next()
        return
      }

      if (vendorHandler) {
        const handled = await vendorHandler(req, res)
        if (handled) return
      }

      if (staticHandler) {
        const handled = await staticHandler(req, res)
        if (handled) return
      }

      next()
    },
  })
  if (port !== undefined) server.listen(port)
  return server
}
