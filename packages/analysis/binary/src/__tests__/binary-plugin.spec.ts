import {
  getRegisteredAnalysisPlugins,
  ProjectAnalyzer,
  resetAnalysisRegistry,
} from '@xomda/analysis-core'
import { beforeEach, describe, expect, it } from 'vitest'

import { binaryPlugin } from '../index'

describe('binaryPlugin manifest', () => {
  it('self-registers in the analysis registry on import', () => {
    expect(getRegisteredAnalysisPlugins().map((p) => p.id)).toContain('binary')
  })

  it('has neither detect nor patterns (it is baseline-only)', () => {
    expect(binaryPlugin.detect).toBeUndefined()
    expect(binaryPlugin.patterns).toBeUndefined()
  })
})

describe('binaryPlugin.fileTypesFor', () => {
  beforeEach(() => {
    resetAnalysisRegistry()
  })

  const analyzer = () => new ProjectAnalyzer().register(binaryPlugin)

  it('routes png to image preview', () => {
    const r = analyzer().fileTypesFor('assets/logo.png')
    expect(r.preview).toEqual({ kind: 'image' })
  })

  it('routes svg to image preview (rendered, not as text)', () => {
    const r = analyzer().fileTypesFor('icons/gear.svg')
    expect(r.preview).toEqual({ kind: 'image' })
  })

  it('routes zip to binary preview (HexView on the client)', () => {
    const r = analyzer().fileTypesFor('build/release.zip')
    expect(r.preview).toEqual({ kind: 'binary' })
  })

  it('routes pdf to binary preview', () => {
    const r = analyzer().fileTypesFor('docs/manual.pdf')
    expect(r.preview).toEqual({ kind: 'binary' })
  })

  it('routes ttf to binary preview', () => {
    const r = analyzer().fileTypesFor('assets/Inter.ttf')
    expect(r.preview).toEqual({ kind: 'binary' })
  })

  it('returns no preview for an unclaimed text-like extension', () => {
    const r = analyzer().fileTypesFor('README.md')
    expect(r.preview).toBeUndefined()
  })

  it('does not contribute matches for unknown extensions', () => {
    const r = analyzer().fileTypesFor('LICENSE')
    expect(r.matches).toEqual([])
  })
})
