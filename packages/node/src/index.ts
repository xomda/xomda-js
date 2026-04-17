import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseArgs } from './cli'
import { listenWithFallback, PortUnavailableError } from './listen'
import { createHttpServer } from './server'
import { c, getServerUrls, openUrl, printBanner, startKeypressHandler } from './tui'

export const DEFAULT_PORT = 6431

const startedAt = Date.now()

let cli
try {
  cli = parseArgs(process.argv.slice(2))
} catch (err) {
  process.stderr.write(`${c.red('error')}: ${(err as Error).message}\n`)
  process.exit(1)
}

const requestedPort = cli.port ?? Number(process.env.XOMDA_PORT ?? DEFAULT_PORT)
const portWasExplicit = cli.port !== undefined || process.env.XOMDA_PORT !== undefined

if (process.cwd().endsWith('packages/node')) {
  process.chdir('../../')
}

const staticDir = resolve(process.cwd(), 'packages/client/dist')

const staticEnabled = existsSync(staticDir)

const server = createHttpServer(undefined, staticEnabled ? staticDir : undefined)

listenWithFallback(server, requestedPort)
  .then(({ port, attempts }) => {
    const urls = getServerUrls(port)
    printBanner({
      name: 'xΟΔ',
      tagline: 'xomda.js',
      startupMs: Date.now() - startedAt,
      urls,
      staticDir: staticEnabled ? staticDir : undefined,
      cwd: process.cwd(),
    })

    if (attempts > 0) {
      const noun = attempts === 1 ? 'port' : 'ports'
      process.stdout.write(
        `  ${c.yellow('note')}: ${c.dim(
          `port ${requestedPort} was busy, started on ${port} after trying ${attempts} ${noun}`
        )}\n\n`
      )
    }

    if (cli.open) openUrl(urls.local[0])

    startKeypressHandler({
      primaryUrl: () => urls.local[0],
    })
  })
  .catch((err: Error) => {
    if (err instanceof PortUnavailableError) {
      process.stderr.write(
        `\n  ${c.red('error')}: ${err.message}\n` +
          `  ${c.dim(
            portWasExplicit
              ? 'Pass a different --port or free up the requested one.'
              : 'Pass --port <number> to choose a specific port.'
          )}\n\n`
      )
    } else {
      const code = (err as NodeJS.ErrnoException).code
      const detail = code ? ` (${code})` : ''
      process.stderr.write(
        `\n  ${c.red('error')}: failed to start server${detail}: ${err.message}\n\n`
      )
    }
    process.exit(1)
  })
