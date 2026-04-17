import { afterEach, describe, expect, it } from 'vitest'

import { createHttpServer } from '../server'

describe('createHttpServer', () => {
  const server = createHttpServer()
  afterEach(() => server.close())

  it('creates a server instance', () => {
    expect(server).toBeDefined()
  })

  it('responds with JSON on request', () =>
    new Promise<void>((resolve, reject) => {
      server.listen(0, () => {
        const { port } = server.address() as { port: number }
        fetch(`http://localhost:${port}`)
          .then((r) => r.json())
          .then((body) => {
            const typed = body as { error: { message: string } }
            expect(typed.error.message).toEqual('No procedure found on path ""')
            resolve()
          })
          .catch(reject)
      })
    }))
})
