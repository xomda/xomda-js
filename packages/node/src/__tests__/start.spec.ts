import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { startServer } from '../start'

describe('startServer', () => {
  let staticDir: string
  let vendorRoot: string
  let vendorManifestPath: string

  beforeAll(() => {
    staticDir = mkdtempSync(join(tmpdir(), 'xomda-start-static-'))
    writeFileSync(join(staticDir, 'index.html'), '<!doctype html><html>spa</html>')

    vendorRoot = mkdtempSync(join(tmpdir(), 'xomda-start-vendor-'))
    const vueDir = join(vendorRoot, 'vue')
    mkdirSync(vueDir, { recursive: true })
    writeFileSync(join(vueDir, 'index.js'), 'export const vue = 1')

    vendorManifestPath = join(vendorRoot, 'vendor.manifest.json')
    writeFileSync(vendorManifestPath, JSON.stringify({ vue: vueDir }))
  })

  let running: Awaited<ReturnType<typeof startServer>> | undefined

  afterEach(async () => {
    if (running) {
      await running.close()
      running = undefined
    }
  })

  it('boots on an ephemeral port and exposes the actual port', async () => {
    running = await startServer({ port: 0, banner: false, keypress: false })
    expect(running.port).toBeGreaterThan(0)
    const r = await fetch(`http://localhost:${running.port}/`)
    expect(r.status).toBe(404)
  })

  it('serves the static SPA index when staticDir is provided', async () => {
    running = await startServer({ port: 0, staticDir, banner: false, keypress: false })
    const r = await fetch(`http://localhost:${running.port}/`)
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('spa')
  })

  it('serves /vendor/<pkg> when vendorManifestPath is provided', async () => {
    running = await startServer({
      port: 0,
      vendorManifestPath,
      banner: false,
      keypress: false,
    })
    const r = await fetch(`http://localhost:${running.port}/vendor/vue/index.js`)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe('export const vue = 1')
  })

  it('falls back to the next port when requested port is busy', async () => {
    running = await startServer({ port: 0, banner: false, keypress: false })
    const busyPort = running.port
    const second = await startServer({ port: busyPort, banner: false, keypress: false })
    expect(second.port).toBeGreaterThan(busyPort)
    await second.close()
  })

  describe('cwd override', () => {
    // chdir is process-global, so each case captures + restores cwd around itself.
    let originalCwd: string
    let sandboxDir: string

    beforeAll(() => {
      sandboxDir = mkdtempSync(join(tmpdir(), 'xomda-start-cwd-'))
    })

    afterEach(() => {
      if (originalCwd) {
        process.chdir(originalCwd)
        originalCwd = ''
      }
    })

    // macOS resolves /var → /private/var, and process.cwd() returns the canonical
    // path. Compare on realpath to avoid spurious failures.
    const sandboxReal = () => realpathSync(sandboxDir)

    it('chdirs into the supplied --cwd before the server is wired up', async () => {
      originalCwd = process.cwd()
      running = await startServer({ port: 0, cwd: sandboxDir, banner: false, keypress: false })
      expect(process.cwd()).toBe(sandboxReal())
    })

    it('honors XOMDA_CWD env when no --cwd is passed', async () => {
      originalCwd = process.cwd()
      process.env.XOMDA_CWD = sandboxDir
      try {
        running = await startServer({ port: 0, banner: false, keypress: false })
        expect(process.cwd()).toBe(sandboxReal())
      } finally {
        delete process.env.XOMDA_CWD
      }
    })

    it('--cwd wins over XOMDA_CWD when both are set', async () => {
      const otherDir = mkdtempSync(join(tmpdir(), 'xomda-start-cwd-other-'))
      originalCwd = process.cwd()
      process.env.XOMDA_CWD = otherDir
      try {
        running = await startServer({ port: 0, cwd: sandboxDir, banner: false, keypress: false })
        expect(process.cwd()).toBe(sandboxReal())
      } finally {
        delete process.env.XOMDA_CWD
        rmSync(otherDir, { recursive: true, force: true })
      }
    })
  })
})
