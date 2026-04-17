import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { PUBLISH_EXTERNALS } from '../../client/vite-plugins/externals.ts'
import { buildPublishArtifact, REPO_ROOT, STAGE_DIR, STAGE_PARENT } from '../scripts/build.ts'

interface PackageJson {
  name: string
  version: string
  bin: Record<string, string>
  files: string[]
  engines: { node: string }
  dependencies: Record<string, string>
  repository: { type: string; url: string }
  author: string
  license: string
  type: 'module'
  exports: Record<string, string>
}

const VITE_BUILD_TIMEOUT_MS = 5 * 60_000

describe('buildPublishArtifact', () => {
  let result: Awaited<ReturnType<typeof buildPublishArtifact>>
  let stagedPkg: PackageJson
  let tarballEntries: string[]

  beforeAll(async () => {
    result = await buildPublishArtifact({ quiet: true })
    stagedPkg = JSON.parse(
      await readFile(resolve(STAGE_DIR, 'package.json'), 'utf8')
    ) as PackageJson
    tarballEntries = listTarball(result.tarballPath!)
  }, VITE_BUILD_TIMEOUT_MS)

  describe('artifact placement', () => {
    it('writes the tarball to target/npm/xomda-<version>.tgz', () => {
      expect(result.tarballPath).toBe(resolve(STAGE_PARENT, `xomda-${result.version}.tgz`))
      expect(existsSync(result.tarballPath!)).toBe(true)
    })

    it('produces a tarball under 50 MB (sanity ceiling)', () => {
      const size = statSync(result.tarballPath!).size
      expect(size).toBeLessThan(50 * 1024 * 1024)
    })

    it('stages everything beneath target/npm/xomda/', () => {
      expect(STAGE_DIR.startsWith(REPO_ROOT)).toBe(true)
      expect(STAGE_DIR.endsWith('/target/npm/xomda')).toBe(true)
    })
  })

  describe('package.json metadata', () => {
    it('is named "xomda" (not "xomda.js" or "@xomda/bundle")', () => {
      expect(stagedPkg.name).toBe('xomda')
    })

    it('inherits version from the root package.json', () => {
      expect(stagedPkg.version).toBe(result.version)
      expect(stagedPkg.version).toMatch(/^\d+\.\d+\.\d+/)
    })

    it('declares an MIT license, repository, author (required for npm provenance)', () => {
      expect(stagedPkg.license).toBe('MIT')
      expect(stagedPkg.repository.url).toMatch(/^git\+https:\/\//)
      expect(stagedPkg.author).toContain('Joris Aerts')
    })

    it('uses ESM and points bin at dist/cli.js', () => {
      expect(stagedPkg.type).toBe('module')
      expect(stagedPkg.bin.xomda).toBe('./dist/cli.js')
    })

    it('requires Node 22.6+', () => {
      expect(stagedPkg.engines.node).toMatch(/>=\s*22\.6/)
    })

    it('whitelists files (no implicit publishing of source)', () => {
      expect(stagedPkg.files).toContain('dist')
      expect(stagedPkg.files).toContain('client')
      expect(stagedPkg.files).toContain('LICENSE')
      expect(stagedPkg.files).toContain('README.md')
    })

    it('lists every SPA external as a runtime dependency', () => {
      for (const ext of PUBLISH_EXTERNALS) {
        expect(stagedPkg.dependencies[ext]).toBeDefined()
      }
    })

    it('includes commander and @trpc/server (node-side externals)', () => {
      expect(stagedPkg.dependencies.commander).toBeDefined()
      expect(stagedPkg.dependencies['@trpc/server']).toBeDefined()
    })
  })

  describe('staged tree contents', () => {
    it('ships the bundled CLI with a shebang and executable bit', async () => {
      const cli = resolve(STAGE_DIR, 'dist', 'cli.js')
      const text = await readFile(cli, 'utf8')
      expect(text.startsWith('#!/usr/bin/env node\n')).toBe(true)
      const mode = statSync(cli).mode & 0o777
      expect(mode & 0o100).not.toBe(0)
    })

    it('ships the pre-built SPA at client/index.html', () => {
      expect(existsSync(resolve(STAGE_DIR, 'client', 'index.html'))).toBe(true)
    })

    it('ships the SPA vendor manifest', async () => {
      const manifestPath = resolve(STAGE_DIR, 'client', 'vendor.manifest.json')
      expect(existsSync(manifestPath)).toBe(true)
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, string>
      for (const ext of PUBLISH_EXTERNALS) {
        expect(manifest[ext], `${ext} missing from vendor.manifest.json`).toBeDefined()
      }
    })

    it('ships the LICENSE', () => {
      expect(existsSync(resolve(STAGE_DIR, 'LICENSE'))).toBe(true)
    })

    it('ships the rendered README.md', async () => {
      const readme = await readFile(resolve(STAGE_DIR, 'README.md'), 'utf8')
      expect(readme).toContain('npx xomda')
      expect(readme).not.toContain('{{version}}')
    })
  })

  describe('tarball entries', () => {
    it('includes dist/cli.js', () => {
      expect(tarballEntries).toContain('package/dist/cli.js')
    })

    it('includes client/index.html', () => {
      expect(tarballEntries).toContain('package/client/index.html')
    })

    it('includes client/vendor.manifest.json', () => {
      expect(tarballEntries).toContain('package/client/vendor.manifest.json')
    })

    it('includes LICENSE and README.md', () => {
      expect(tarballEntries).toContain('package/LICENSE')
      expect(tarballEntries).toContain('package/README.md')
    })

    it('does NOT include node_modules', () => {
      expect(tarballEntries.some((e) => e.includes('node_modules/'))).toBe(false)
    })

    it('does NOT include source TypeScript files', () => {
      expect(tarballEntries.some((e) => e.endsWith('.ts') && !e.endsWith('.d.ts'))).toBe(false)
    })

    it('does NOT include test or spec files', () => {
      expect(tarballEntries.some((e) => /\.spec\.|__tests__/.test(e))).toBe(false)
    })

    it('does NOT include vite or build configs', () => {
      expect(tarballEntries.some((e) => /vite\.config/.test(e))).toBe(false)
      expect(tarballEntries.some((e) => /tsconfig/.test(e))).toBe(false)
    })

    it('does NOT include the package.template.json', () => {
      expect(tarballEntries).not.toContain('package/package.template.json')
    })
  })

  describe('integrity invariants', () => {
    it('the bundled CLI keeps node:* built-ins external (not polyfilled)', async () => {
      const cli = await readFile(resolve(STAGE_DIR, 'dist', 'cli.js'), 'utf8')
      expect(cli).toMatch(/from\s+["']node:fs["']/)
      expect(cli).toMatch(/from\s+["']node:path["']/)
      expect(cli).toMatch(/from\s+["']node:url["']/)
    })

    it('the bundled CLI keeps commander external (not inlined)', async () => {
      const cli = await readFile(resolve(STAGE_DIR, 'dist', 'cli.js'), 'utf8')
      expect(cli).toMatch(/from\s+["']commander["']/)
    })

    it('the bundled CLI keeps @trpc/server external', async () => {
      const cli = await readFile(resolve(STAGE_DIR, 'dist', 'cli.js'), 'utf8')
      expect(cli).toMatch(/from\s+["']@trpc\/server/)
    })

    it('the bundled CLI inlines @xomda/* (workspace packages must not appear as bare imports)', async () => {
      const cli = await readFile(resolve(STAGE_DIR, 'dist', 'cli.js'), 'utf8')
      // Match bare workspace-package specifiers used as ESM imports.
      expect(cli).not.toMatch(/from\s+["']@xomda\//)
    })

    it('the SPA index.html ships an importmap with /vendor/* targets', async () => {
      const html = await readFile(resolve(STAGE_DIR, 'client', 'index.html'), 'utf8')
      expect(html).toContain('<script type="importmap">')
      expect(html).toContain('/vendor/')
    })
  })

  // Runtime smoke (--help, --version, server boot, /vendor/*) needs the
  // tarball installed where commander / @trpc/server are resolvable. See
  // install-smoke.spec.ts.
})

function listTarball(tarball: string): string[] {
  const r = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`tar -tzf failed: ${r.stderr}`)
  return r.stdout.trim().split('\n')
}
