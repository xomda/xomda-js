import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { createHttpServer } from './server'

const PORT = Number(process.env.PORT ?? 3000)

if (process.cwd().endsWith('packages/node')) {
  process.chdir('../../')
}

const staticDir = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : resolve(process.cwd(), 'packages/client/dist')

const staticEnabled = existsSync(staticDir)

createHttpServer(PORT, staticEnabled ? staticDir : undefined)

console.log(`xomda node server running at http://localhost:${PORT}`)
console.log(`Working directory: ${process.cwd()}`)
console.log(`Static: ${staticEnabled ? staticDir : 'disabled'}`)
