import type { ChildProcess } from 'node:child_process'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildPublishArtifact } from '../scripts/build.ts'

const BUILD_TIMEOUT_MS = 5 * 60_000
const INSTALL_TIMEOUT_MS = 3 * 60_000

// On Windows, `npm`/`npx` and the installed `.bin/xomda` shim are all
// `.cmd` files; Node's spawn won't resolve `.cmd` without a shell (and
// since CVE-2024-27980 it actively refuses to). Use shell mode on
// Windows and target `.cmd` for the xomda bin.
const SHELL_ON_WIN = process.platform === 'win32'
const BIN_EXT = process.platform === 'win32' ? '.cmd' : ''

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
      shell: SHELL_ON_WIN,
    })
    if (install.status !== 0) {
      throw new Error(
        `npm install failed (status ${install.status}):\n${install.stderr ?? ''}\n${install.stdout ?? ''}`
      )
    }

    xomdaBin = resolve(installDir, 'node_modules', '.bin', `xomda${BIN_EXT}`)
    if (!existsSync(xomdaBin)) {
      throw new Error(`xomda bin not present at ${xomdaBin} after npm install`)
    }
  }, BUILD_TIMEOUT_MS + INSTALL_TIMEOUT_MS)

  afterAll(() => {
    if (!installDir) return
    try {
      // Windows can hold file handles open for a moment after `npm install`
      // and the just-killed `xomda` server, so a naïve rmSync races against
      // EPERM/EBUSY. `maxRetries` + `retryDelay` (Node's built-in linear
      // backoff for rmSync) handles the common case; wrap the whole thing
      // in try/catch so a stubborn cleanup doesn't fail an otherwise-green
      // run — the OS reaps the tmpdir later.
      rmSync(installDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch (err) {
      console.warn(`failed to clean install dir ${installDir}:`, (err as Error).message)
    }
  })

  it('installs the bin into node_modules/.bin/xomda', () => {
    expect(existsSync(xomdaBin)).toBe(true)
  })

  it('runs `xomda --version` and reports a semver-shaped string', () => {
    const r = spawnSync(xomdaBin, ['--version'], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      shell: SHELL_ON_WIN,
    })
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it("resolves `import { createEntity } from 'xomda-js'` and the helper works", () => {
    // The user-facing surface promise: a fresh `npm install xomda-js` lets you
    // build a model in TypeScript / Node without ever reaching into internal
    // `@xomda/*` packages. Spawn a Node child rather than `import()` so the
    // resolution path is identical to what a user's project would see.
    const r = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        "import { createEntity, createAttribute, writeModel } from 'xomda-js';" +
          "const e = createEntity({ name: 'Author', attributes: [createAttribute({ name: 'id', type: 'uuid', primaryKey: true })] });" +
          "console.log(JSON.stringify({ name: e.name, attrs: e.attributes.length, hasWrite: typeof writeModel === 'function' }));",
      ],
      { cwd: installDir, encoding: 'utf8' }
    )
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0)
    const out = JSON.parse(r.stdout.trim()) as { name: string; attrs: number; hasWrite: boolean }
    expect(out).toEqual({ name: 'Author', attrs: 1, hasWrite: true })
  })

  it('runs `xomda --help` and lists every subcommand', () => {
    const r = spawnSync(xomdaBin, ['--help'], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      shell: SHELL_ON_WIN,
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('serve')
    expect(r.stdout).toContain('generate')
    expect(r.stdout).toContain('preview')
    expect(r.stdout).toContain('diff')
    expect(r.stdout).toContain('wrapper')
  })

  it('`xomda wrapper` succeeds and writes xomdaw scripts (version self-resolved)', async () => {
    // Regression guard: readOwnCliVersion() previously only accepted package
    // names '@xomda/cli' and 'xomda', so in the published tarball (named
    // 'xomda-js') the version could never be determined and `wrapper` always
    // threw "could not determine xomda version".
    const wrapperDir = join(installDir, 'wrapper-test')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(wrapperDir, { recursive: true })
    const r = spawnSync(xomdaBin, ['wrapper', '--root', wrapperDir], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      shell: SHELL_ON_WIN,
    })
    expect(r.status, `wrapper failed:\n${r.stderr}`).toBe(0)
    expect(r.stdout).toContain('xomdaw pinned to')
    expect(existsSync(join(wrapperDir, 'xomdaw'))).toBe(true)
    expect(existsSync(join(wrapperDir, 'xomdaw.cmd'))).toBe(true)
  })

  it('emits ANSI color codes when color is forced (picocolors not stubbed)', () => {
    // Regression guard for the colorless-output bug: Vite's default "client"
    // build environment honors picocolors' legacy `browser` package.json
    // field, which is a no-op stub where every color function returns the raw
    // string — silently stripping all CLI coloring. We mark picocolors
    // external so the real Node implementation resolves at runtime; this test
    // proves it from the *installed* tarball, exactly as an end user gets it.
    //
    // picocolors only emits ANSI when it believes color is supported, so we
    // force it via FORCE_COLOR (and clear NO_COLOR, which the other smoke
    // tests set). The `wrapper` command colors both its success (green/bold)
    // and error (red) paths, so we assert on the combined output and don't
    // care which branch ran — only that it's colored.
    const r = spawnSync(xomdaBin, ['wrapper'], {
      cwd: installDir,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: '' },
      shell: SHELL_ON_WIN,
    })
    // eslint-disable-next-line no-control-regex
    expect(`${r.stdout}${r.stderr}`).toMatch(/\x1b\[\d+m/)
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
            shell: SHELL_ON_WIN,
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
