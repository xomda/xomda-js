import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createHttpServer } from '../server'

/**
 * Locks the CORS policy against the regression that historically shipped:
 * `Access-Control-Allow-Origin: *` on a server that exposes
 * `fileRouter.read` / `getStats` / `list` / `readBytes`. With `*` any
 * third-party page a user visits while `xomda serve` is running could
 * fetch arbitrary files reachable from cwd.
 */
describe('createHttpServer CORS policy', () => {
  type RunningServer = { url: string; close: () => Promise<void> }

  async function start(
    options: Parameters<typeof createHttpServer>[1] = {}
  ): Promise<RunningServer> {
    const server = createHttpServer(undefined, options)
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const { port } = server.address() as AddressInfo
    return {
      url: `http://localhost:${port}`,
      close: () =>
        new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve()))
        ),
    }
  }

  let running: RunningServer | undefined
  beforeEach(() => {
    running = undefined
  })
  afterEach(async () => {
    if (running) await running.close()
  })

  it('does not emit Allow-Origin: * on any request', async () => {
    running = await start({ corsOrigins: ['http://localhost:5173'] })
    const res = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://attacker.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('echoes the Origin only when it matches the allow-list', async () => {
    running = await start({ corsOrigins: ['http://localhost:5173'] })
    const allowed = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    // tRPC adapter may set its own Vary tokens (trpc-accept, accept); ensure
    // Origin is among them.
    expect(
      allowed.headers
        .get('vary')
        ?.split(',')
        .map((s) => s.trim())
    ).toContain('Origin')

    const denied = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://attacker.example' },
    })
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects preflight from disallowed origins with 403', async () => {
    running = await start({ corsOrigins: ['http://localhost:5173'] })
    const res = await fetch(`${running.url}/trpc/file.read`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://attacker.example',
        'access-control-request-method': 'POST',
      },
    })
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('answers preflight 204 from allowed origin', async () => {
    running = await start({ corsOrigins: ['http://localhost:5173'] })
    const res = await fetch(`${running.url}/trpc/file.read`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('emits no CORS headers when corsOrigins is explicitly empty (publish-mode)', async () => {
    running = await start({ corsOrigins: [] })
    const res = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    // We do not add Origin to Vary in publish-mode. tRPC may still add its own
    // Vary tokens; assert specifically that Origin is NOT in there.
    const varyTokens =
      res.headers
        .get('vary')
        ?.split(',')
        .map((s) => s.trim()) ?? []
    expect(varyTokens).not.toContain('Origin')
  })

  it('publish-mode (staticDir set, no corsOrigins) defaults to no CORS', async () => {
    // staticDir to a path that does not exist is fine — the handler is
    // created but won't serve anything; we only care about the CORS branch.
    running = await start({ staticDir: '/tmp/xomda-nonexistent-publish-test' })
    const res = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://anywhere.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('dev-mode (no staticDir, no corsOrigins) defaults to allow Vite dev origin', async () => {
    running = await start()
    const res = await fetch(`${running.url}/trpc/`, {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})
