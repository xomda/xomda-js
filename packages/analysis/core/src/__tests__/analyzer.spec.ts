import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProjectAnalyzer } from '../analyzer'
import type { AnalysisPlugin } from '../types'

const { mockReadFile, mockExistsSync, mockReaddirSync } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }))
vi.mock('node:fs', () => ({ existsSync: mockExistsSync, readdirSync: mockReaddirSync }))

describe('ProjectAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFile.mockResolvedValue(null)
    mockExistsSync.mockReturnValue(false)
    mockReaddirSync.mockReturnValue([])
  })

  describe('listPlugins', () => {
    it('returns empty array when no plugins registered', () => {
      expect(new ProjectAnalyzer().listPlugins()).toEqual([])
    })

    it('returns id and name for each registered plugin', () => {
      const analyzer = new ProjectAnalyzer()
        .register({ id: 'a', name: 'Plugin A', patterns: [] })
        .register({ id: 'b', name: 'Plugin B', patterns: [] })
      expect(analyzer.listPlugins()).toEqual([
        { id: 'a', name: 'Plugin A' },
        { id: 'b', name: 'Plugin B' },
      ])
    })
  })

  describe('analyze — file-exists pattern', () => {
    it('detects plugin when a matched path exists', async () => {
      mockExistsSync.mockReturnValue(true)
      const analyzer = new ProjectAnalyzer().register({
        id: 'ts',
        name: 'TypeScript',
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toEqual([{ pluginId: 'ts', name: 'TypeScript' }])
    })

    it('does not detect plugin when none of its paths exist', async () => {
      const analyzer = new ProjectAnalyzer().register({
        id: 'ant',
        name: 'Ant',
        patterns: [{ type: 'file-exists', paths: ['build.xml'] }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toHaveLength(0)
    })

    it('caches repeated fileExists checks for the same path', async () => {
      mockExistsSync.mockReturnValue(true)
      const pluginA: AnalysisPlugin = {
        id: 'a',
        name: 'Plugin A',
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
      }
      const pluginB: AnalysisPlugin = {
        id: 'b',
        name: 'Plugin B',
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
      }
      const analyzer = new ProjectAnalyzer().register(pluginA).register(pluginB)
      await analyzer.analyze('/project')
      expect(mockExistsSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('analyze — custom detect function', () => {
    it('detects plugin when detect returns true', async () => {
      const analyzer = new ProjectAnalyzer().register({
        id: 'custom',
        name: 'Custom Plugin',
        detect: () => true,
      })
      const result = await analyzer.analyze('/any/path')
      expect(result.features).toEqual([{ pluginId: 'custom', name: 'Custom Plugin' }])
    })

    it('does not detect plugin when detect returns false', async () => {
      const analyzer = new ProjectAnalyzer().register({
        id: 'custom',
        name: 'Custom Plugin',
        detect: () => false,
      })
      const result = await analyzer.analyze('/any/path')
      expect(result.features).toHaveLength(0)
    })

    it('supports async detect function', async () => {
      const analyzer = new ProjectAnalyzer().register({
        id: 'async',
        name: 'Async Plugin',
        detect: async () => true,
      })
      const result = await analyzer.analyze('/any/path')
      expect(result.features).toEqual([{ pluginId: 'async', name: 'Async Plugin' }])
    })

    it('passes AnalysisContext with correct rootPath to detect', async () => {
      let receivedRootPath: string | undefined
      await new ProjectAnalyzer()
        .register({
          id: 'ctx-check',
          name: 'Context Check',
          detect: (ctx) => {
            receivedRootPath = ctx.rootPath
            return false
          },
        })
        .analyze('/some/path')
      expect(receivedRootPath).toBe('/some/path')
    })

    it('detect receives listFiles that returns root directory entries', async () => {
      mockReaddirSync.mockReturnValue(['MyApp.sln', 'README.md'])
      const analyzer = new ProjectAnalyzer().register({
        id: 'vs',
        name: 'Visual Studio',
        detect: (ctx) => ctx.listFiles().some((f) => f.endsWith('.sln')),
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toEqual([{ pluginId: 'vs', name: 'Visual Studio' }])
    })
  })

  describe('analyze — file-content pattern', () => {
    it('detects plugin when file content matches a string', async () => {
      mockReadFile.mockResolvedValue('{"react": "^18"}')
      const analyzer = new ProjectAnalyzer().register({
        id: 'pkg',
        name: 'Package',
        patterns: [{ type: 'file-content', path: 'package.json', match: '"react"' }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toEqual([{ pluginId: 'pkg', name: 'Package' }])
    })

    it('detects plugin when file content matches a regexp', async () => {
      mockReadFile.mockResolvedValue('{"react": "^18"}')
      const analyzer = new ProjectAnalyzer().register({
        id: 'pkg',
        name: 'Package',
        patterns: [{ type: 'file-content', path: 'package.json', match: /react/ }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toEqual([{ pluginId: 'pkg', name: 'Package' }])
    })

    it('does not detect plugin when file content does not match', async () => {
      mockReadFile.mockResolvedValue('{}')
      const analyzer = new ProjectAnalyzer().register({
        id: 'pkg',
        name: 'Package',
        patterns: [{ type: 'file-content', path: 'package.json', match: '"react"' }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toHaveLength(0)
    })

    it('does not detect plugin when the file does not exist', async () => {
      const analyzer = new ProjectAnalyzer().register({
        id: 'pkg',
        name: 'Package',
        patterns: [{ type: 'file-content', path: 'package.json', match: '"react"' }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toHaveLength(0)
    })

    it('reads each shared content file path only once across multiple plugins', async () => {
      mockReadFile.mockResolvedValue('{"react":"^18","vue":"^3"}')
      const analyzer = new ProjectAnalyzer()
        .register({
          id: 'a',
          name: 'Plugin A',
          patterns: [{ type: 'file-content', path: 'package.json', match: '"react"' }],
        })
        .register({
          id: 'b',
          name: 'Plugin B',
          patterns: [{ type: 'file-content', path: 'package.json', match: '"vue"' }],
        })
      await analyzer.analyze('/project')
      expect(mockReadFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('analyze — result shape', () => {
    it('returns rootPath matching input', async () => {
      const result = await new ProjectAnalyzer().analyze('/my/project')
      expect(result.rootPath).toBe('/my/project')
    })

    it('returns analyzedAt as an ISO date string', async () => {
      const result = await new ProjectAnalyzer().analyze('/any')
      expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('returns features in plugin registration order', async () => {
      const analyzer = new ProjectAnalyzer()
        .register({ id: 'first', name: 'First', detect: () => true })
        .register({ id: 'second', name: 'Second', detect: () => true })
      const result = await analyzer.analyze('/any')
      expect(result.features.map((f) => f.pluginId)).toEqual(['first', 'second'])
    })

    it('returns an empty projects array when no plugin contributes projectKind', async () => {
      const result = await new ProjectAnalyzer()
        .register({ id: 'x', name: 'X', detect: () => true })
        .analyze('/any')
      expect(result.projects).toEqual([])
    })
  })

  describe('analyze — manifest fields on detected features', () => {
    it('carries plugin icon and fileTypes onto the detected feature', async () => {
      mockExistsSync.mockReturnValue(true)
      const analyzer = new ProjectAnalyzer().register({
        id: 'ts',
        name: 'TypeScript',
        icon: 'typescript',
        fileTypes: [{ id: 'ts', label: 'TypeScript', match: { extensions: ['ts', 'tsx'] } }],
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
      })
      const result = await analyzer.analyze('/project')
      expect(result.features).toHaveLength(1)
      const feature = result.features[0]
      expect(feature.icon).toBe('typescript')
      expect(feature.fileTypes).toHaveLength(1)
      expect(feature.fileTypes?.[0].id).toBe('ts')
    })

    it('runs inspect when the plugin is detected and attaches the match', async () => {
      mockExistsSync.mockReturnValue(true)
      const inspect = vi.fn().mockResolvedValue({
        matched: true as const,
        roots: ['src', 'tests'],
        details: { references: ['./tsconfig.app.json'] },
      })
      const analyzer = new ProjectAnalyzer().register({
        id: 'ts',
        name: 'TypeScript',
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
        inspect,
      })
      const result = await analyzer.analyze('/project')
      expect(inspect).toHaveBeenCalledTimes(1)
      expect(result.features[0].match?.roots).toEqual(['src', 'tests'])
      expect(result.features[0].match?.details).toEqual({
        references: ['./tsconfig.app.json'],
      })
    })

    it('does not call inspect when the plugin is not detected', async () => {
      const inspect = vi.fn()
      await new ProjectAnalyzer()
        .register({
          id: 'never',
          name: 'Never',
          detect: () => false,
          inspect,
        })
        .analyze('/project')
      expect(inspect).not.toHaveBeenCalled()
    })

    it('tolerates inspect returning null', async () => {
      mockExistsSync.mockReturnValue(true)
      const analyzer = new ProjectAnalyzer().register({
        id: 'ts',
        name: 'TypeScript',
        patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
        inspect: async () => null,
      })
      const result = await analyzer.analyze('/project')
      expect(result.features[0].match).toBeUndefined()
    })
  })

  describe('registerAll', () => {
    it('registers each plugin in iteration order', () => {
      const analyzer = new ProjectAnalyzer().registerAll([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ])
      expect(analyzer.listPlugins().map((p) => p.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('fileTypesFor', () => {
    const tsPlugin: AnalysisPlugin = {
      id: 'typescript',
      name: 'TypeScript',
      icon: 'typescript-icon',
      fileTypes: [
        {
          id: 'ts',
          label: 'TypeScript',
          match: { extensions: ['ts', 'tsx'] },
          preview: { kind: 'text', language: 'typescript' },
          priority: 10,
        },
        {
          id: 'tsconfig',
          label: 'tsconfig',
          match: { filenames: ['tsconfig.json'] },
          preview: { kind: 'text', language: 'json' },
        },
      ],
    }
    const vitePlugin: AnalysisPlugin = {
      id: 'vite',
      name: 'Vite',
      icon: 'vite-icon',
      fileTypes: [
        {
          id: 'vite-overlay',
          label: 'Vite',
          // overlay-only — adds icon, no preview override
          match: { extensions: ['ts', 'tsx', 'js'] },
        },
      ],
    }

    it('returns matching descriptors from every plugin (multi-match)', () => {
      const result = new ProjectAnalyzer()
        .register(tsPlugin)
        .register(vitePlugin)
        .fileTypesFor('src/index.ts')
      expect(result.matches.map((m) => m.fileType.id)).toEqual(['ts', 'vite-overlay'])
    })

    it('picks the highest-priority preview hint', () => {
      const result = new ProjectAnalyzer()
        .register(tsPlugin)
        .register(vitePlugin)
        .fileTypesFor('src/index.ts')
      expect(result.preview).toEqual({ kind: 'text', language: 'typescript' })
    })

    it('matches by filename', () => {
      const result = new ProjectAnalyzer().register(tsPlugin).fileTypesFor('tsconfig.json')
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].fileType.id).toBe('tsconfig')
    })

    it('matches by glob', () => {
      const cy: AnalysisPlugin = {
        id: 'cypress',
        name: 'Cypress',
        fileTypes: [
          {
            id: 'cy-spec',
            label: 'Cypress spec',
            match: { pathGlobs: ['**/*.cy.ts'] },
          },
        ],
      }
      const result = new ProjectAnalyzer().register(cy).fileTypesFor('cypress/e2e/foo.cy.ts')
      expect(result.matches.map((m) => m.fileType.id)).toEqual(['cy-spec'])
    })

    it('returns no preview when no descriptor declares one', () => {
      const result = new ProjectAnalyzer().register(vitePlugin).fileTypesFor('src/index.ts')
      expect(result.preview).toBeUndefined()
      expect(result.matches).toHaveLength(1)
    })

    it('returns plugin icon alongside each match', () => {
      const result = new ProjectAnalyzer().register(tsPlugin).fileTypesFor('src/index.ts')
      expect(result.matches[0].pluginIcon).toBe('typescript-icon')
    })

    it('returns empty matches for unclaimed paths', () => {
      const result = new ProjectAnalyzer().register(tsPlugin).fileTypesFor('README.md')
      expect(result.matches).toEqual([])
      expect(result.preview).toBeUndefined()
    })
  })
})
