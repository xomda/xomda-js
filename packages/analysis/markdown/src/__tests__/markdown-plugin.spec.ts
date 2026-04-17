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

describe('markdownPlugin.fileTypesFor', () => {
  beforeEach(() => {
    resetAnalysisRegistry()
  })

  const analyzer = () => new ProjectAnalyzer().register(markdownPlugin)

  it('routes .md to markdown text preview', () => {
    const r = analyzer().fileTypesFor('README.md')
    expect(r.preview).toEqual({ kind: 'text', language: 'markdown' })
  })

  it('routes .mdc to markdown text preview', () => {
    const r = analyzer().fileTypesFor('docs/rules.mdc')
    expect(r.preview).toEqual({ kind: 'text', language: 'markdown' })
  })

  it('routes .markdown to markdown text preview', () => {
    const r = analyzer().fileTypesFor('CHANGELOG.markdown')
    expect(r.preview).toEqual({ kind: 'text', language: 'markdown' })
  })

  it('routes .mkd / .mdown / .rmd to markdown text preview', () => {
    const a = analyzer()
    expect(a.fileTypesFor('a.mkd').preview).toEqual({ kind: 'text', language: 'markdown' })
    expect(a.fileTypesFor('a.mdown').preview).toEqual({ kind: 'text', language: 'markdown' })
    expect(a.fileTypesFor('a.rmd').preview).toEqual({ kind: 'text', language: 'markdown' })
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
