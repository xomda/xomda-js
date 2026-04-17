import type { Server } from 'node:http'
import { resolve } from 'node:path'

import { listenWithFallback } from './listen'
import { createHttpServer } from './server'
import { colors, getServerUrls, openUrl, printBanner, startKeypressHandler } from './tui'

export const DEFAULT_PORT = 6431

export interface StartServerOptions {
  /** Listening port. Defaults to `XOMDA_PORT` env or `DEFAULT_PORT` (6431). */
  port?: number
  /** Whether the caller passed `--port` explicitly. Tunes the error message on port-unavailable. */
  portWasExplicit?: boolean
  /** Absolute path to the pre-built SPA. If absent or missing on disk, static is disabled. */
  staticDir?: string
  /** Absolute path to vendor.manifest.json. If absent, /vendor/* is not served. */
  vendorManifestPath?: string
  /** Auto-open the local URL in the default browser. */
  open?: boolean
  /** Print the startup banner. Default `true`. Disable in tests. */
  banner?: boolean
  /** Register the interactive keypress handler on stdin. Default `true`. Disable in tests. */
  keypress?: boolean
  /** Tagline shown next to the wordmark in the banner. Default `'xomda.js'`. */
  tagline?: string
  /**
   * Project root the server should treat as cwd. When set (or `XOMDA_CWD` env present),
   * `process.chdir()` runs before any router code, so all the lazy `process.cwd()` reads
   * downstream pick it up. Lets tests and scripts point the server at a sandbox project
   * without depending on shell-level `cd`.
   */
  cwd?: string
}

export interface StartServerResult {
  /** Actual port the server bound to (may differ from requested when the requested port was busy). */
  port: number
  /** Underlying Node http.Server. */
  server: Server
  /** Shut the server down. */
  close: () => Promise<void>
}

/**
 * Boots the xomda tRPC/HTTP server with the same banner + keypress UX as `pnpm dev`.
 *
 * Surfaces port-busy as an actionable message but does not call `process.exit` — the
 * caller (bin entry) decides how to react. Tests can disable the banner/keypress side
 * effects via `banner: false, keypress: false`.
 *
 * Errors from `listenWithFallback` propagate; `PortUnavailableError` is decorated
 * with a context-aware hint before re-throwing.
 */
export async function startServer(options: StartServerOptions = {}): Promise<StartServerResult> {
  const startedAt = Date.now()
  const requestedPort = options.port ?? Number(process.env.XOMDA_PORT ?? DEFAULT_PORT)

  const cwdOverride = options.cwd ?? process.env.XOMDA_CWD
  if (cwdOverride) {
    process.chdir(resolve(cwdOverride))
  }

  const server = createHttpServer(undefined, {
    staticDir: options.staticDir,
    vendorManifestPath: options.vendorManifestPath,
  })

  const { port, attempts } = await listenWithFallback(server, requestedPort)

  const urls = getServerUrls(port)

  if (options.banner !== false) {
    printBanner({
      name: 'xΟΔ',
      tagline: options.tagline ?? 'xomda.js',
      startupMs: Date.now() - startedAt,
      urls,
      staticDir: options.staticDir,
      cwd: process.cwd(),
    })

    if (attempts > 0) {
      const noun = attempts === 1 ? 'port' : 'ports'
      process.stdout.write(
        `  ${colors.yellow('note')}: ${colors.dim(
          `port ${requestedPort} was busy, started on ${port} after trying ${attempts} ${noun}`
        )}\n\n`
      )
    }
  }

  if (options.open) openUrl(urls.local[0])

  if (options.keypress !== false) {
    startKeypressHandler({ primaryUrl: () => urls.local[0] })
  }

  return {
    port,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      }),
  }
}
