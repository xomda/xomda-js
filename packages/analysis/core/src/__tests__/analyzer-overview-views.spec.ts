import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProjectAnalyzer } from '../analyzer'
import type { AnalysisPlugin } from '../types'

const { mockReadFile, mockExistsSync, mockReaddirSync, mockStatSync } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({ readFile: mockReadFile }))
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockReadFile.mockResolvedValue(null)
  mockExistsSync.mockReturnValue(false)
  mockReaddirSync.mockReturnValue([])
  mockStatSync.mockImplementation(() => {
    throw new Error('no stat')
  })
})

describe('ProjectAnalyzer.viewsFor', () => {
  it('returns empty for unmatched paths', () => {
    const analyzer = new ProjectAnalyzer()
    expect(analyzer.viewsFor('main.ts')).toEqual([])
  })

  it("wraps a preview shorthand into a single 'default' view", () => {
    const plugin: AnalysisPlugin = {
      id: 'ts',
      name: 'TypeScript',
      icon: 'ts-icon',
      fileTypes: [
        {
          id: 'ts',
          label: 'TS source',
          match: { extensions: ['ts'] },
          preview: { kind: 'text', language: 'typescript' },
        },
      ],
    }
    const r = new ProjectAnalyzer().register(plugin).viewsFor('main.ts')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      pluginId: 'ts',
      pluginIcon: 'ts-icon',
      fileTypeId: 'ts',
      views: [
        {
          id: 'default',
          label: 'Preview',
          preview: { kind: 'text', language: 'typescript' },
          hasLoadViewData: false,
        },
      ],
    })
  })

  it('returns explicit views unchanged (multi-tab)', () => {
    const plugin: AnalysisPlugin = {
      id: 'maven',
      name: 'Maven',
      fileTypes: [
        {
          id: 'pom',
          label: 'POM',
          match: { filenames: ['pom.xml'] },
          views: [
            { id: 'source', label: 'Source', preview: { kind: 'text', language: 'xml' } },
            {
              id: 'info',
              label: 'Info',
              preview: { kind: 'custom', componentId: 'maven-pom-info' },
              loadViewData: async () => ({}),
            },
          ],
        },
      ],
    }
    const r = new ProjectAnalyzer().register(plugin).viewsFor('pom.xml')
    expect(r).toHaveLength(1)
    expect(r[0].views.map((v) => v.id)).toEqual(['source', 'info'])
    expect(r[0].views[1].hasLoadViewData).toBe(true)
    expect(r[0].views[0].hasLoadViewData).toBe(false)
  })

  it('skips matchers that declare neither preview nor views (icon overlay only)', () => {
    const plugin: AnalysisPlugin = {
      id: 'vite',
      name: 'Vite',
      fileTypes: [
        {
          id: 'overlay',
          label: 'Vite',
          match: { extensions: ['ts'] },
          // No preview, no views — icon-only overlay.
          icon: 'vite',
        },
      ],
    }
    expect(new ProjectAnalyzer().register(plugin).viewsFor('main.ts')).toEqual([])
  })

  it('unions views across multiple matching plugins', () => {
    const ts: AnalysisPlugin = {
      id: 'ts',
      name: 'TS',
      fileTypes: [
        {
          id: 'ts',
          label: 'TS',
          match: { extensions: ['ts'] },
          preview: { kind: 'text', language: 'typescript' },
        },
      ],
    }
    const vite: AnalysisPlugin = {
      id: 'vite',
      name: 'Vite',
      fileTypes: [
        {
          id: 'vite-overlay',
          label: 'Vite',
          match: { extensions: ['ts'] },
          preview: { kind: 'text', language: 'typescript' },
        },
      ],
    }
    const r = new ProjectAnalyzer().register(ts).register(vite).viewsFor('main.ts')
    expect(r.map((e) => e.pluginId)).toEqual(['ts', 'vite'])
  })
})

describe('ProjectAnalyzer.overviewFor', () => {
  it('returns empty array when no plugin defines loadOverview', async () => {
    const analyzer = new ProjectAnalyzer().register({
      id: 'a',
      name: 'A',
      patterns: [{ type: 'file-exists', paths: ['a'] }],
    })
    expect(await analyzer.overviewFor('/r')).toEqual([])
  })

  it('aggregates contributions from every plugin that returns non-null', async () => {
    const a: AnalysisPlugin = {
      id: 'a',
      name: 'A',
      loadOverview: async () => ({
        pluginId: 'a',
        pluginName: 'A',
        sections: [{ id: 's1', kind: 'key-value', title: 'A', rows: [] }],
      }),
    }
    const b: AnalysisPlugin = {
      id: 'b',
      name: 'B',
      loadOverview: async () => null,
    }
    const c: AnalysisPlugin = {
      id: 'c',
      name: 'C',
      loadOverview: async () => ({
        pluginId: 'c',
        pluginName: 'C',
        sections: [{ id: 's1', kind: 'list', title: 'C', items: [] }],
      }),
    }
    const r = await new ProjectAnalyzer().register(a).register(b).register(c).overviewFor('/r')
    expect(r.map((c) => c.pluginId)).toEqual(['a', 'c'])
  })

  it('respects the enabledPluginIds allow-list', async () => {
    const a: AnalysisPlugin = {
      id: 'a',
      name: 'A',
      loadOverview: async () => ({
        pluginId: 'a',
        pluginName: 'A',
        sections: [],
      }),
    }
    const b: AnalysisPlugin = {
      id: 'b',
      name: 'B',
      loadOverview: async () => ({
        pluginId: 'b',
        pluginName: 'B',
        sections: [],
      }),
    }
    const analyzer = new ProjectAnalyzer().register(a).register(b)
    const r = await analyzer.overviewFor('/r', { enabledPluginIds: new Set(['b']) })
    expect(r.map((c) => c.pluginId)).toEqual(['b'])
  })

  it('caches by marker mtime when the plugin has a projectKind.marker', async () => {
    const loadOverview = vi.fn().mockResolvedValue({
      pluginId: 'maven',
      pluginName: 'Maven',
      sections: [],
    })
    const plugin: AnalysisPlugin = {
      id: 'maven',
      name: 'Maven',
      projectKind: { marker: 'pom.xml' },
      loadOverview,
    }
    const analyzer = new ProjectAnalyzer().register(plugin)

    mockStatSync.mockReturnValue({ mtimeMs: 1000 })
    await analyzer.overviewFor('/r')
    await analyzer.overviewFor('/r') // cache hit
    expect(loadOverview).toHaveBeenCalledTimes(1)

    mockStatSync.mockReturnValue({ mtimeMs: 2000 }) // marker changed
    await analyzer.overviewFor('/r')
    expect(loadOverview).toHaveBeenCalledTimes(2)
  })
})

describe('ProjectAnalyzer.loadViewData', () => {
  it('returns undefined when the plugin/fileType/view is not found', async () => {
    const analyzer = new ProjectAnalyzer()
    expect(await analyzer.loadViewData('/r', 'x', 'y', 'z', 'p')).toBeUndefined()
  })

  it('returns undefined when the view has no loader', async () => {
    const plugin: AnalysisPlugin = {
      id: 'maven',
      name: 'Maven',
      fileTypes: [
        {
          id: 'pom',
          label: 'POM',
          match: { filenames: ['pom.xml'] },
          views: [{ id: 'source', label: 'Source', preview: { kind: 'text', language: 'xml' } }],
        },
      ],
    }
    const r = await new ProjectAnalyzer()
      .register(plugin)
      .loadViewData('/r', 'maven', 'pom', 'source', 'pom.xml')
    expect(r).toBeUndefined()
  })

  it('calls the view loader with an AnalysisContext rooted at rootPath', async () => {
    const load = vi.fn().mockResolvedValue({ groupId: 'org.example', artifactId: 'demo' })
    const plugin: AnalysisPlugin = {
      id: 'maven',
      name: 'Maven',
      fileTypes: [
        {
          id: 'pom',
          label: 'POM',
          match: { filenames: ['pom.xml'] },
          views: [
            {
              id: 'info',
              label: 'Info',
              preview: { kind: 'custom', componentId: 'maven-pom-info' },
              loadViewData: load,
            },
          ],
        },
      ],
    }
    const r = await new ProjectAnalyzer()
      .register(plugin)
      .loadViewData('/r', 'maven', 'pom', 'info', 'pom.xml')
    expect(r).toEqual({ groupId: 'org.example', artifactId: 'demo' })
    expect(load).toHaveBeenCalledTimes(1)
    const ctx = load.mock.calls[0][0]
    expect(ctx.rootPath).toBe('/r')
    expect(load.mock.calls[0][1]).toBe('pom.xml')
  })

  it('caches by file mtime', async () => {
    const load = vi.fn().mockResolvedValue({ ok: true })
    const plugin: AnalysisPlugin = {
      id: 'maven',
      name: 'Maven',
      fileTypes: [
        {
          id: 'pom',
          label: 'POM',
          match: { filenames: ['pom.xml'] },
          views: [
            {
              id: 'info',
              label: 'Info',
              preview: { kind: 'custom', componentId: 'maven-pom-info' },
              loadViewData: load,
            },
          ],
        },
      ],
    }
    const analyzer = new ProjectAnalyzer().register(plugin)

    mockStatSync.mockReturnValue({ mtimeMs: 100 })
    await analyzer.loadViewData('/r', 'maven', 'pom', 'info', 'pom.xml')
    await analyzer.loadViewData('/r', 'maven', 'pom', 'info', 'pom.xml')
    expect(load).toHaveBeenCalledTimes(1)

    mockStatSync.mockReturnValue({ mtimeMs: 200 })
    await analyzer.loadViewData('/r', 'maven', 'pom', 'info', 'pom.xml')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
