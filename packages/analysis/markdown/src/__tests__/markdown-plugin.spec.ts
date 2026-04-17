import {
  getRegisteredAnalysisPlugins,
  ProjectAnalyzer,
  resetAnalysisRegistry,
} from '@xomda/analysis-core'
import { beforeEach, describe, expect, it } from 'vitest'

import { markdownPlugin } from '../index'

describe('markdownPlugin manifest', () => {
  it('self-registers in the analysis registry on import', () => {
    expect(getRegisteredAnalysisPlugins().map((p) => p.id)).toContain('markdown')
  })

  it('has neither detect nor patterns (it is baseline-only)', () => {
    expect(markdownPlugin.detect).toBeUndefined()
    expect(markdownPlugin.patterns).toBeUndefined()
  })
})

describe('markdownPlugin.fileTypesFor / viewsFor', () => {
  beforeEach(() => {
    resetAnalysisRegistry()
  })

  const analyzer = () => new ProjectAnalyzer().register(markdownPlugin)

  it('routes .md to the rendered preview as the default view', () => {
    const r = analyzer().fileTypesFor('README.md')
    expect(r.preview).toEqual({ kind: 'custom', componentId: 'markdown-rendered' })
  })

  it('also exposes a source view alongside rendered', () => {
    const entries = analyzer().viewsFor('README.md')
    const md = entries.find((e) => e.pluginId === 'markdown')
    expect(md?.views.map((v) => v.id)).toEqual(['rendered', 'source'])
    expect(md?.views[1]?.preview).toEqual({ kind: 'text', language: 'markdown' })
  })

  it('routes every recognised markdown extension', () => {
    const a = analyzer()
    for (const path of ['a.mdc', 'a.markdown', 'a.mkd', 'a.mdown', 'a.rmd']) {
      const r = a.fileTypesFor(path)
      expect(r.preview).toEqual({ kind: 'custom', componentId: 'markdown-rendered' })
    }
  })

  it('does not claim non-markdown extensions', () => {
    const r = analyzer().fileTypesFor('main.ts')
    expect(r.matches).toEqual([])
  })

  it('yields preview routing when a higher-priority plugin also claims the path', () => {
    // Hypothetical docs-bundler plugin claiming README.md at priority 30.
    const higher = new ProjectAnalyzer().register(markdownPlugin).register({
      id: 'docs-bundler',
      name: 'Docs Bundler',
      fileTypes: [
        {
          id: 'docs-readme',
          label: 'Docs README',
          match: { filenames: ['README.md'] },
          preview: { kind: 'text', language: 'mdx' },
          priority: 30,
        },
      ],
    })
    const r = higher.fileTypesFor('README.md')
    expect(r.preview).toEqual({ kind: 'text', language: 'mdx' })
    // markdown plugin still contributes a match for the icon overlay.
    expect(r.matches.map((m) => m.pluginId)).toContain('markdown')
  })
})
