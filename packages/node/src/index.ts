import { createHttpServer } from './server'

const PORT = Number(process.env.PORT ?? 3000)

// Change working directory to project root if started from packages/node
if (process.cwd().endsWith('packages/node')) {
  process.chdir('../../')
}

createHttpServer(PORT)
console.log(`xomda node server running at http://localhost:${PORT}`)
console.log(`Working directory: ${process.cwd()}`)
