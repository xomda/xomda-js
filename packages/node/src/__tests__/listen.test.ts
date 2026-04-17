import { createServer, type Server } from 'node:http'

import { afterEach, describe, expect, it } from 'vitest'

import { listenWithFallback, PortUnavailableError } from '../listen'

const noop = () => {}

describe('listenWithFallback', () => {
  const cleanup: Server[] = []

  afterEach(() => {
    while (cleanup.length) cleanup.pop()?.close()
  })

  it('listens on the requested port when free', async () => {
    const server = createServer(noop)
    cleanup.push(server)
    const result = await listenWithFallback(server, 0)
    expect(result.attempts).toBe(0)
    expect(result.port).toBeGreaterThan(0)
  })

  it('falls back to next port when busy', async () => {
    const blocker = createServer(noop)
    cleanup.push(blocker)
    await new Promise<void>((r) => blocker.listen(0, r))
    const busyPort = (blocker.address() as { port: number }).port

    const server = createServer(noop)
    cleanup.push(server)
    const result = await listenWithFallback(server, busyPort)
    expect(result.attempts).toBeGreaterThanOrEqual(1)
    expect(result.port).toBeGreaterThan(busyPort)
  })

  it('rejects with PortUnavailableError after exhausting attempts', async () => {
    const blocker = createServer(noop)
    cleanup.push(blocker)
    await new Promise<void>((r) => blocker.listen(0, r))
    const busyPort = (blocker.address() as { port: number }).port

    const blocker2 = createServer(noop)
    cleanup.push(blocker2)
    await new Promise<void>((r) => blocker2.listen(busyPort + 1, r))

    const server = createServer(noop)
    cleanup.push(server)
    await expect(listenWithFallback(server, busyPort, 2)).rejects.toBeInstanceOf(
      PortUnavailableError
    )
  })
})
