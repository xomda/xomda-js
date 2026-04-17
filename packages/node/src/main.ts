import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseArgs } from './cli'
import { PortUnavailableError } from './listen'
import { startServer } from './start'
import { colors } from './tui'

// Dev workspace layout: this file is packages/node/src/index.ts; the SPA build
// lives at packages/client/dist. Resolve via import.meta.url so we don't depend
// on process.cwd() (which varies across `pnpm start`, IDE runners, and tests).
// The bundled `xomda` entry computes staticDir from its own location instead.
const __dirname = dirname(fileURLToPath(import.meta.url))
const staticDir = resolve(__dirname, '../../client/dist')
const vendorManifestPath = resolve(staticDir, 'vendor.manifest.json')

let cli
try {
  cli = parseArgs(process.argv.slice(2))
} catch (err) {
  process.stderr.write(`${colors.red('error')}: ${(err as Error).message}\n`)
  process.exit(1)
}

const portWasExplicit = cli.port !== undefined || process.env.XOMDA_PORT !== undefined

try {
  await startServer({
    port: cli.port,
    portWasExplicit,
    open: cli.open,
    cwd: cli.cwd,
    staticDir: existsSync(staticDir) ? staticDir : undefined,
    vendorManifestPath: existsSync(vendorManifestPath) ? vendorManifestPath : undefined,
  })
} catch (err) {
  if (err instanceof PortUnavailableError) {
    const hint = portWasExplicit
      ? 'Pass a different --port or free up the requested one.'
      : 'Pass --port <number> to choose a specific port.'
    process.stderr.write(`\n  ${colors.red('error')}: ${err.message}\n  ${colors.dim(hint)}\n\n`)
  } else {
    const e = err as NodeJS.ErrnoException
    const code = e.code ? ` (${e.code})` : ''
    process.stderr.write(
      `\n  ${colors.red('error')}: failed to start server${code}: ${e.message}\n\n`
    )
  }
  process.exit(1)
}

export { DEFAULT_PORT } from './start'
