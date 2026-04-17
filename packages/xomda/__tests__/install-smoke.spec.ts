import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildPublishArtifact } from '../scripts/build.ts'

const BUILD_TIMEOUT_MS = 5 * 60_000
const INSTALL_TIMEOUT_MS = 3 * 60_000

/**
 * End-to-end smoke: build the tarball, `npm install` it into a throwaway
 * directory, then exercise the resulting `xomda` binary. This is the test
 * that catches integration regressions a structural inspection misses:
 * external deps resolving correctly, the bin shebang being honored, the
 * server actually binding, the vendor manifest being read, the SPA index
 * being served.
 *
 * Slow by design — one `npm install` per run. Excluded from quick test
 * loops; runs in CI and in any pre-publish gate.
 */
describe.runIf(!process.env.XOMDA_SKIP_INSTALL_SMOKE)('install smoke', () => {
  let tarballPath: string
  let installDir: string
  let xomdaBin: string

  beforeAll(async () => {
    const result = await buildPublishArtifact({ quiet: true })
    if (!result.tarballPath) throw new Error('build did not produce a tarball')
    tarballPath = result.tarballPath

    installDir = mkdtempSync(join(tmpdir(), 'xomda-install-smoke-'))
    writeFileSync(
      join(installDir, 'package.json'),
      JSON.stringify({ name: 'xomda-install-smoke', version: '0.0.0', private: true }, null, 2)
    )

    const install = spawnSync('npm', ['install', tarballPath, '--no-audit', '--no-fund'], {
      cwd: installDir,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: INSTALL_TIMEOUT_MS,
    })
    if (install.status !== 0) {
      throw new Error(
        `npm install failed (status ${install.status}):\n${install.stderr ?? ''}\n${install.stdout ?? ''}`
      )
    }

    xomdaBin = resolve(installDir, 'node_modules', '.bin', 'xomda')
    if (!existsSync(xomdaBin)) {
      throw new Error(`xomda bin not present at ${xomdaBin} after npm install`)
    }
  }, BUILD_TIMEOUT_MS + INSTALL_TIMEOUT_MS)

  afterAll(() => {
    if (installDir) rmSync(installDir, { recursive: true, force: true })
  })

  it('installs the bin into node_modules/.bin/xomda', () => {
    expect(existsSync(xomdaBin)).toBe(true)
  })

  it('runs `xomda --version` and reports a semver-shaped string', () => {
    const r = spawnSync(xomdaBin, ['--version'], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    })
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('runs `xomda --help` and lists every subcommand', () => {
    const r = spawnSync(xomdaBin, ['--help'], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('serve')
    expect(r.stdout).toContain('generate')
    expect(r.stdout).toContain('preview')
    expect(r.stdout).toContain('diff')
    expect(r.stdout).toContain('wrapper')
  })

  describe('serving (default command)', () => {
    let server: ChildProcess | undefined
    let port: number | undefined

    afterAll(async () => {
      if (server && !server.killed) {
        server.kill('SIGTERM')
        await new Promise((r) => setTimeout(r, 200))
        if (!server.killed) server.kill('SIGKILL')
      }
    })

    it('boots the server, prints the local URL', async () => {
      const result = await new Promise<{ proc: ChildProcess; port: number }>(
        (resolveBoot, reject) => {
          const proc = spawn(xomdaBin, ['--port', '0'], {
            cwd: installDir,
            env: { ...process.env, NO_COLOR: '1', XOMDA_PORT: '0' },
            stdio: ['ignore', 'pipe', 'pipe'],
          })
          let stdout = ''
          const timer = setTimeout(() => {
            proc.kill('SIGKILL')
            reject(new Error(`server did not print a URL within 15s; stdout:\n${stdout}`))
          }, 15_000)
          proc.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString()
            const match = stdout.match(/http:\/\/localhost:(\d+)/)
            if (match) {
              clearTimeout(timer)
              resolveBoot({ proc, port: Number(match[1]) })
            }
          })
          proc.on('exit', (code) => {
            clearTimeout(timer)
            reject(new Error(`server exited prematurely with code ${code}; stdout:\n${stdout}`))
          })
          proc.on('error', (err) => {
            clearTimeout(timer)
            reject(err)
          })
        }
      )
      server = result.proc
      port = result.port
      expect(port).toBeGreaterThan(0)
    })

    it('serves the SPA at / (200 + HTML)', async () => {
      const r = await fetch(`http://localhost:${port}/`)
      expect(r.status).toBe(200)
      expect(r.headers.get('content-type')).toMatch(/text\/html/)
      const body = await r.text()
      expect(body).toContain('<!doctype html>')
      expect(body).toContain('<script type="importmap">')
    })

    it('serves /vendor/lodash-es/lodash.js (200 + real lodash)', async () => {
      const r = await fetch(`http://localhost:${port}/vendor/lodash-es/lodash.js`)
      expect(r.status).toBe(200)
      expect(r.headers.get('content-type')).toMatch(/text\/javascript/)
      const body = await r.text()
      expect(body).toContain('Lodash')
    })

    it('serves a deep vendor path (/vendor/lodash-es/debounce.js)', async () => {
      const r = await fetch(`http://localhost:${port}/vendor/lodash-es/debounce.js`)
      expect(r.status).toBe(200)
      const body = await r.text()
      expect(body).toContain('debounce')
    })

    it('refuses to expose the vendor manifest itself', async () => {
      const r = await fetch(`http://localhost:${port}/vendor.manifest.json`)
      expect(r.status).toBe(404)
    })

    it('responds on /trpc/<unknown-path> with a tRPC error (server alive)', async () => {
      const r = await fetch(`http://localhost:${port}/trpc/`)
      expect([400, 404]).toContain(r.status)
    })

    it('falls back to index.html for SPA routes', async () => {
      const r = await fetch(`http://localhost:${port}/some/spa/route`)
      expect(r.status).toBe(200)
      expect(r.headers.get('content-type')).toMatch(/text\/html/)
    })
  })
})
