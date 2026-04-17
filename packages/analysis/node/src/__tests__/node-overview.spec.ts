import type { AnalysisContext } from '@xomda/analysis-core'
import { describe, expect, it } from 'vitest'

import { nodePlugin } from '../index'
import { detectPackageManager, parsePackageJson } from '../package-parser'

const FULL_PKG = JSON.stringify({
  name: 'demo',
  version: '1.2.3',
  description: 'A demo package',
  license: 'MIT',
  type: 'module',
  main: 'dist/index.js',
  scripts: { build: 'tsc', test: 'vitest run' },
  dependencies: { react: '^19.0.0', vue: '^3.5.0' },
  devDependencies: { vitest: '^4.0.0' },
  workspaces: ['packages/*', 'apps/*'],
  packageManager: 'pnpm@10.0.0',
  engines: { node: '>=20' },
})

describe('parsePackageJson', () => {
  it('returns null for invalid JSON', () => {
    expect(parsePackageJson('not json')).toBeNull()
  })

  it('extracts all fields we care about', () => {
    const meta = parsePackageJson(FULL_PKG)!
    expect(meta.name).toBe('demo')
    expect(meta.version).toBe('1.2.3')
    expect(meta.scripts).toEqual({ build: 'tsc', test: 'vitest run' })
    expect(meta.dependencies.react).toBe('^19.0.0')
    expect(meta.workspaces).toEqual(['packages/*', 'apps/*'])
    expect(meta.packageManager).toBe('pnpm@10.0.0')
    expect(meta.engines.node).toBe('>=20')
  })

  it('accepts workspaces with object shape ({ packages: [] })', () => {
    const meta = parsePackageJson(JSON.stringify({ workspaces: { packages: ['packages/*'] } }))!
    expect(meta.workspaces).toEqual(['packages/*'])
  })
})

describe('detectPackageManager', () => {
  const baseMeta = parsePackageJson(FULL_PKG)!

  it('prefers packageManager when set', async () => {
    const r = await detectPackageManager(baseMeta, () => false)
    expect(r).toEqual({ label: 'pnpm@10.0.0', source: 'packageManager' })
  })

  it('falls back to pnpm lockfile when packageManager is absent', async () => {
    const meta = { ...baseMeta, packageManager: undefined }
    const r = await detectPackageManager(meta, (p) => p === 'pnpm-lock.yaml')
    expect(r?.source).toBe('pnpm-lock.yaml')
    expect(r?.label).toMatch(/pnpm/i)
  })

  it('returns null when nothing is detectable', async () => {
    const meta = { ...baseMeta, packageManager: undefined }
    const r = await detectPackageManager(meta, () => false)
    expect(r).toBeNull()
  })
})

function ctxWith(pkg: string | null, lockfiles: Set<string> = new Set()): AnalysisContext {
  return {
    rootPath: '/r',
    fileExists: (p) => (p === 'package.json' ? pkg !== null : lockfiles.has(p)),
    listFiles: () => [],
    readFile: async (p) => (p === 'package.json' ? pkg : null),
  }
}

describe('nodePlugin.loadOverview', () => {
  it('returns null when package.json is missing', async () => {
    expect(await nodePlugin.loadOverview!(ctxWith(null))).toBeNull()
  })

  it('returns null when package.json is invalid JSON', async () => {
    expect(await nodePlugin.loadOverview!(ctxWith('{ broken'))).toBeNull()
  })

  it('emits identity, scripts, deps, workspaces, and package manager sections', async () => {
    const contribution = await nodePlugin.loadOverview!(ctxWith(FULL_PKG))
    expect(contribution).not.toBeNull()
    const ids = contribution!.sections.map((s) => s.id)
    expect(ids).toContain('identity')
    expect(ids).toContain('scripts')
    expect(ids).toContain('deps')
    expect(ids).toContain('dev-deps')
    expect(ids).toContain('workspaces')
    expect(ids).toContain('package-manager')
    expect(ids).toContain('engines')
  })
})

describe('nodePlugin package.json multi-view', () => {
  it('declares Source + Info views', () => {
    const fileType = nodePlugin.fileTypes?.find((f) => f.id === 'package-json')
    expect(fileType?.views).toHaveLength(2)
    expect(fileType?.views?.map((v) => v.id)).toEqual(['source', 'info'])
  })

  it('Info view loader parses package.json into NodePackageMeta', async () => {
    const fileType = nodePlugin.fileTypes?.find((f) => f.id === 'package-json')
    const info = fileType?.views?.find((v) => v.id === 'info')
    const data = (await info!.loadViewData!(ctxWith(FULL_PKG), 'package.json')) as {
      name: string
    }
    expect(data.name).toBe('demo')
  })
})
