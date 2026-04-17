import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createVendorHandler } from '../vendor'

describe('createVendorHandler', () => {
  let rootDir: string
  let manifestPath: string
  let server: Server
  let port: number

  beforeAll(async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'xomda-vendor-'))
    const vueDir = join(rootDir, 'vue')
    const vueusePkg = join(rootDir, '@vueuse', 'core')
    mkdirSync(join(vueDir, 'dist'), { recursive: true })
    mkdirSync(vueusePkg, { recursive: true })
    writeFileSync(join(vueDir, 'dist', 'vue.runtime.esm-browser.js'), 'export const vue = 1')
    writeFileSync(join(vueusePkg, 'index.mjs'), 'export const useThing = 2')

    manifestPath = join(rootDir, 'vendor.manifest.json')
    writeFileSync(manifestPath, JSON.stringify({ vue: vueDir, '@vueuse/core': vueusePkg }, null, 2))

    const handler = createVendorHandler(manifestPath)
    if (!handler) throw new Error('handler was not created')

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
    rmSync(rootDir, { recursive: true, force: true })
  })

  const request = (path: string) => fetch(`http://localhost:${port}${path}`)

  it('serves deep package paths under a bare-name root', async () => {
    const r = await request('/vendor/vue/dist/vue.runtime.esm-browser.js')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/text\/javascript/)
    expect(await r.text()).toBe('export const vue = 1')
  })

  it('serves scoped packages (longest-prefix match)', async () => {
    const r = await request('/vendor/@vueuse/core/index.mjs')
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('export const useThing = 2')
  })

  it('returns 404 for the manifest itself', async () => {
    const r = await request('/vendor.manifest.json')
    expect(r.status).toBe(404)
  })

  it('returns 404 for unknown deep paths inside a known package', async () => {
    const r = await request('/vendor/vue/does-not-exist.js')
    expect(r.status).toBe(404)
  })

  it('does not handle requests for unmapped packages (returns false)', async () => {
    const r = await request('/vendor/react/index.js')
    expect(r.status).toBe(599)
  })

  it('does not handle non-/vendor paths', async () => {
    const r = await request('/foo/bar')
    expect(r.status).toBe(599)
  })

  it('blocks path traversal (returns false)', async () => {
    const handler = createVendorHandler(manifestPath)
    if (!handler) throw new Error('handler was not created')
    const req = { method: 'GET', url: '/vendor/vue/..%2F..%2Fetc/passwd' } as IncomingMessage
    const res = {} as ServerResponse
    const handled = await handler(req, res)
    expect(handled).toBe(false)
  })

  it('returns undefined when the manifest file does not exist', () => {
    const handler = createVendorHandler(join(rootDir, 'missing.json'))
    expect(handler).toBeUndefined()
  })
})
