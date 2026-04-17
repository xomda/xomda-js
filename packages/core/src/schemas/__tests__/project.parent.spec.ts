import { describe, expect, it } from 'vitest'

import { ProjectFileSchema, ProjectSettingsSchema } from '../project'

describe('F1 — parentProject + restrictReadsToProjectRoot on ProjectFileSchema', () => {
  it('project without parentProject parses', () => {
    const p = ProjectFileSchema.parse({ name: 'P' })
    expect(p.parentProject).toBeUndefined()
  })

  it('project with parentProject: "../parent" parses', () => {
    const p = ProjectFileSchema.parse({ name: 'P', parentProject: '../parent' })
    expect(p.parentProject).toBe('../parent')
  })

  it('parentProject round-trips through parse/stringify/parse', () => {
    const p = ProjectFileSchema.parse({ name: 'P', parentProject: './sub/parent' })
    const reParsed = ProjectFileSchema.parse(JSON.parse(JSON.stringify(p)))
    expect(reParsed.parentProject).toBe('./sub/parent')
  })

  it('parentProject accepts an absolute-looking path string (validation deferred to security guard)', () => {
    const p = ProjectFileSchema.parse({ name: 'P', parentProject: '/abs/path' })
    expect(p.parentProject).toBe('/abs/path')
  })

  it('settings.restrictReadsToProjectRoot defaults to true', () => {
    const s = ProjectSettingsSchema.parse({})
    expect(s.restrictReadsToProjectRoot).toBe(true)
  })

  it('settings.restrictReadsToProjectRoot can be explicitly set to false', () => {
    const s = ProjectSettingsSchema.parse({ restrictReadsToProjectRoot: false })
    expect(s.restrictReadsToProjectRoot).toBe(false)
  })

  it('legacy project.json without restrictReadsToProjectRoot key parses (defaults applied)', () => {
    const p = ProjectFileSchema.parse({ name: 'P' })
    expect(p.settings.restrictReadsToProjectRoot).toBe(true)
  })
})
