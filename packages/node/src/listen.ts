import type { Server } from 'node:http'

export const MAX_PORT_ATTEMPTS = 99

export interface ListenResult {
  port: number
  attempts: number
}

export function listenWithFallback(
  server: Server,
  startPort: number,
  maxAttempts = MAX_PORT_ATTEMPTS
): Promise<ListenResult> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    let currentPort = startPort

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE') {
        server.removeListener('error', onError)
        reject(err)
        return
      }
      attempts++
      if (attempts >= maxAttempts) {
        server.removeListener('error', onError)
        reject(new PortUnavailableError(startPort, currentPort, attempts))
        return
      }
      currentPort++
      if (currentPort > 65535) {
        server.removeListener('error', onError)
        reject(new PortUnavailableError(startPort, currentPort - 1, attempts))
        return
      }
      server.listen(currentPort)
    }

    server.on('error', onError)
    server.once('listening', () => {
      server.removeListener('error', onError)
      const addr = server.address()
      const actualPort = typeof addr === 'object' && addr ? addr.port : currentPort
      resolve({ port: actualPort, attempts })
    })

    server.listen(currentPort)
  })
}

export class PortUnavailableError extends Error {
  constructor(
    public readonly startPort: number,
    public readonly lastPort: number,
    public readonly attempts: number
  ) {
    super(`No available port found in range ${startPort}–${lastPort} (tried ${attempts} ports).`)
    this.name = 'PortUnavailableError'
  }
}
