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
    // Lay out the published artifact's runtime shape:
    //   <root>/client/vendor.manifest.json   ← manifest lives next to the SPA
    //   <root>/node_modules/<pkg>/...        ← packages resolved via npm/pnpm
    //
    // The manifest only lists package *names*; the handler resolves each one
    // against the manifest's location at runtime. Baking absolute paths into
    // the manifest at build time would point at the *builder's* filesystem
    // and 404 on every consumer machine.
    rootDir = mkdtempSync(join(tmpdir(), 'xomda-vendor-'))
    const clientDir = join(rootDir, 'client')
    mkdirSync(clientDir, { recursive: true })

    const vueDir = join(rootDir, 'node_modules', 'vue')
    const vueusePkg = join(rootDir, 'node_modules', '@vueuse', 'core')
    mkdirSync(join(vueDir, 'dist'), { recursive: true })
    mkdirSync(vueusePkg, { recursive: true })
    writeFileSync(join(vueDir, 'package.json'), JSON.stringify({ name: 'vue', main: 'index.js' }))
    writeFileSync(join(vueDir, 'index.js'), 'export const vue = 0')
    writeFileSync(join(vueDir, 'dist', 'vue.runtime.esm-browser.js'), 'export const vue = 1')
    writeFileSync(
      join(vueusePkg, 'package.json'),
      JSON.stringify({ name: '@vueuse/core', main: 'index.mjs' })
    )
    writeFileSync(join(vueusePkg, 'index.mjs'), 'export const useThing = 2')

    manifestPath = join(clientDir, 'vendor.manifest.json')
    writeFileSync(manifestPath, JSON.stringify(['vue', '@vueuse/core']))

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

  it('returns undefined when a listed package cannot be resolved from the manifest location', () => {
    // Reproduces the original "absolute paths from the build machine" regression:
    // if the manifest names a package that isn't installed beside it, the handler
    // must fail loudly at startup rather than silently 404 every request.
    const orphanRoot = mkdtempSync(join(tmpdir(), 'xomda-vendor-orphan-'))
    try {
      const orphanManifest = join(orphanRoot, 'vendor.manifest.json')
      writeFileSync(orphanManifest, JSON.stringify(['no-such-package']))
      expect(() => createVendorHandler(orphanManifest)).toThrow(/no-such-package/)
    } finally {
      rmSync(orphanRoot, { recursive: true, force: true })
    }
  })
})
