import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSandbox } from '../sandbox/buildSandbox'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SANDBOX_DIR = resolve(__dirname, '..', 'target', 'sandbox')

await buildSandbox(SANDBOX_DIR, { clean: true })
process.stdout.write(`sandbox ready at ${SANDBOX_DIR}\n`)
