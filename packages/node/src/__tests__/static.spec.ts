import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createStaticHandler } from '../static'

describe('createStaticHandler', () => {
  let staticDir: string
  let server: Server
  let port: number

  beforeAll(async () => {
    staticDir = mkdtempSync(join(tmpdir(), 'xomda-static-'))
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html><html>app</html>')
    mkdirSync(join(staticDir, 'assets'))
    writeFileSync(join(staticDir, 'assets', 'app-abc123.js'), 'console.log("hi")')
    writeFileSync(join(staticDir, 'assets', 'style-xyz789.css'), 'body{margin:0}')

    const handler = createStaticHandler(staticDir)
    server = createServer(async (req, res) => {
      const handled = await handler(req, res)
      if (!handled) {
        res.writeHead(599, { 'Content-Type': 'text/plain' })
        res.end('not handled')
      }
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    port = (server.address() as { port: number }).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(staticDir, { recursive: true, force: true })
  })

  const request = (path: string) => fetch(`http://localhost:${port}${path}`)

  it('serves js asset with correct content-type', async () => {
    const r = await request('/assets/app-abc123.js')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/javascript/)
    expect(await r.text()).toBe('console.log("hi")')
  })

  it('serves css asset with correct content-type', async () => {
    const r = await request('/assets/style-xyz789.css')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/css/)
  })

  it('returns 404 for missing asset with extension', async () => {
    const r = await request('/assets/missing.js')
    expect(r.status).toBe(404)
  })

  it('serves index.html for paths without extension (SPA fallback)', async () => {
    const r = await request('/some/unknown/route')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/html/)
    expect(await r.text()).toBe('<!doctype html><html>app</html>')
  })

  it('serves index.html for the root path', async () => {
    const r = await request('/')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/html/)
    expect(await r.text()).toBe('<!doctype html><html>app</html>')
  })

  it('blocks path traversal (handler returns false)', async () => {
    const handler = createStaticHandler(staticDir)
    const req = { method: 'GET', url: '/..%2F..%2Fetc/passwd' } as IncomingMessage
    const res = {} as ServerResponse
    const handled = await handler(req, res)
    expect(handled).toBe(false)
  })

  it('does not handle non-GET/HEAD methods', async () => {
    const handler = createStaticHandler(staticDir)
    const req = { method: 'POST', url: '/' } as IncomingMessage
    const res = {} as ServerResponse
    const handled = await handler(req, res)
    expect(handled).toBe(false)
  })
})
