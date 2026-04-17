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
  })
})
