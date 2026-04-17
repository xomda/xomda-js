import type { AnalysisContext } from '@xomda/analysis-core'
import { describe, expect, it } from 'vitest'

import { typescriptPlugin } from '../index'

/**
 * Lens 3 H14 coverage: the typescript plugin parses tsconfig.json with a
 * silent `try/catch` and contributes both an inspect verdict + an
 * overview. Bugs in this surface ship silently to the project overview
 * UI. These tests pin the contract: presence detection, parse-error
 * tolerance, and the shape of the overview rows.
 */

const TSCONFIG_FULL = JSON.stringify({
  compilerOptions: {
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'preserve',
    strict: true,
    baseUrl: '.',
    rootDir: 'src',
    paths: {
      '@app/*': ['./src/*'],
      '@util/*': ['./util/*'],
    },
  },
  references: [{ path: '../core' }, { path: '../util' }],
  include: ['src/**/*'],
})

function ctxWith(tsconfig: string | null): AnalysisContext {
  return {
    rootPath: '/r',
    fileExists: () => tsconfig !== null,
    listFiles: () => [],
    readFile: async (path) => (path === 'tsconfig.json' ? tsconfig : null),
  }
}

describe('typescriptPlugin.inspect', () => {
  it('matches when tsconfig.json is absent (the patterns matcher would have already gated this)', async () => {
    const result = await typescriptPlugin.inspect!(ctxWith(null))
    expect(result).toEqual({ matched: true })
  })

  it('tolerates malformed JSON without throwing', async () => {
    const result = await typescriptPlugin.inspect!(ctxWith('{ this is not JSON'))
    // Silent-tolerant: returns matched: true so the overall plugin matches,
    // even though detail extraction failed.
    expect(result).toEqual({ matched: true })
  })

  it('extracts roots from rootDir + include, deduplicating', async () => {
    const result = await typescriptPlugin.inspect!(ctxWith(TSCONFIG_FULL))
    expect(result?.matched).toBe(true)
    expect(result?.roots).toEqual(['src', 'src/**/*'])
  })

  it('extracts references as details.references', async () => {
    const result = await typescriptPlugin.inspect!(ctxWith(TSCONFIG_FULL))
    expect(result?.details).toEqual({ references: ['../core', '../util'] })
  })

  it('handles a minimal tsconfig with no references and no rootDir/include', async () => {
    const tiny = JSON.stringify({ compilerOptions: { target: 'ESNext' } })
    const result = await typescriptPlugin.inspect!(ctxWith(tiny))
    expect(result?.matched).toBe(true)
    expect(result?.roots).toBeUndefined()
    expect(result?.details).toEqual({ references: [] })
  })

  it('filters out references entries with no path', async () => {
    const malformed = JSON.stringify({
      references: [{ path: 'good' }, {}, { path: '' }, { path: 'also-good' }],
    })
    const result = await typescriptPlugin.inspect!(ctxWith(malformed))
    expect(result?.details).toEqual({ references: ['good', 'also-good'] })
  })
})

describe('typescriptPlugin.loadOverview', () => {
  it('returns null when tsconfig.json is missing', async () => {
    expect(await typescriptPlugin.loadOverview!(ctxWith(null))).toBeNull()
  })

  it('returns null on malformed JSON (silent — overview pane shows nothing)', async () => {
    expect(await typescriptPlugin.loadOverview!(ctxWith('{ bad'))).toBeNull()
  })

  it('builds compiler / paths / references sections from a rich tsconfig', async () => {
    const contribution = await typescriptPlugin.loadOverview!(ctxWith(TSCONFIG_FULL))
    expect(contribution).not.toBeNull()
    expect(contribution!.pluginId).toBe('typescript')
    expect(contribution!.pluginName).toBe('TypeScript')

    const sectionIds = contribution!.sections.map((s) => s.id)
    expect(sectionIds).toEqual(['compiler', 'paths', 'references'])

    const compiler = contribution!.sections.find((s) => s.id === 'compiler')
    expect(compiler).toMatchObject({ kind: 'key-value', title: 'compilerOptions' })
    const compilerRows = (compiler as { rows: Array<{ key: string; value: string }> }).rows
    expect(compilerRows.map((r) => r.key)).toEqual([
      'target',
      'module',
      'moduleResolution',
      'jsx',
      'strict',
      'baseUrl',
      'rootDir',
    ])
    expect(compilerRows.find((r) => r.key === 'strict')?.value).toBe('true')

    const paths = contribution!.sections.find((s) => s.id === 'paths')
    expect(paths).toMatchObject({ kind: 'list', title: 'paths' })

    const references = contribution!.sections.find((s) => s.id === 'references')
    expect(references).toMatchObject({ kind: 'list', title: 'References' })
  })

  it('falls back to a single "detected" status section when no detail is available', async () => {
    const empty = JSON.stringify({})
    const contribution = await typescriptPlugin.loadOverview!(ctxWith(empty))
    expect(contribution!.sections).toHaveLength(1)
    expect(contribution!.sections[0]).toMatchObject({
      id: 'detected',
      kind: 'status',
      tone: 'success',
      label: 'tsconfig.json present',
    })
  })

  it('omits the paths section when paths is empty', async () => {
    const noPaths = JSON.stringify({ compilerOptions: { target: 'ESNext', paths: {} } })
    const contribution = await typescriptPlugin.loadOverview!(ctxWith(noPaths))
    const ids = contribution!.sections.map((s) => s.id)
    expect(ids).not.toContain('paths')
  })
})

describe('typescriptPlugin descriptor', () => {
  it('declares fileTypes for ts / tsx / tsconfig / d.ts with priorities', () => {
    const ids = typescriptPlugin.fileTypes!.map((t) => t.id)
    expect(ids).toEqual(['ts', 'tsx', 'tsconfig', 'dts'])
  })

  it('exposes the canonical id and icon', () => {
    expect(typescriptPlugin.id).toBe('typescript')
    expect(typescriptPlugin.icon).toBe('typescript')
  })
})
