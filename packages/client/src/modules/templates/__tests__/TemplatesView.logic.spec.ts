import type { Template } from '@xomda/template'
import { describe, expect, it } from 'vitest'

import { duplicateTemplate } from '../TemplatesView.logic'

const baseTemplate = (overrides: Partial<Template> = {}): Template => ({
  uuid: 'src-uuid',
  name: 'Foo',
  version: '1.0.0',
  description: 'desc',
  scope: 'Entity',
  folder: 'java',
  cells: [{ uuid: 'cell-1', type: 'output', content: 'original' }],
  ...overrides,
})

describe('duplicateTemplate', () => {
  it('returns a copy with a fresh UUID, " (copy)" name, and all other fields preserved', () => {
    const source = baseTemplate()
    const result = duplicateTemplate(source, [source])

    expect(result.uuid).not.toBe(source.uuid)
    expect(result.uuid).toMatch(/^[0-9a-f-]{36}$/i)
    expect(result.name).toBe('Foo (copy)')
    expect(result.version).toBe(source.version)
    expect(result.description).toBe(source.description)
    expect(result.scope).toBe(source.scope)
    expect(result.folder).toBe(source.folder)
    expect(result.cells).toEqual(source.cells)
  })

  it('deep-clones cells so mutating the duplicate does not affect the source', () => {
    const source = baseTemplate()
    const result = duplicateTemplate(source, [source])

    expect(result.cells).not.toBe(source.cells)
    expect(result.cells[0]).not.toBe(source.cells[0])

    result.cells[0].content = 'mutated'
    expect(source.cells[0].content).toBe('original')
  })

  it('appends an incrementing suffix when the " (copy)" name is already taken', () => {
    const source = baseTemplate()
    const sibling1 = baseTemplate({ uuid: 'a', name: 'Foo (copy)' })
    const sibling2 = baseTemplate({ uuid: 'b', name: 'Foo (copy) 2' })

    expect(duplicateTemplate(source, [source, sibling1]).name).toBe('Foo (copy) 2')
    expect(duplicateTemplate(source, [source, sibling1, sibling2]).name).toBe('Foo (copy) 3')
  })

  it('preserves an absent folder (root) by keeping it undefined', () => {
    const source = baseTemplate({ folder: undefined })
    const result = duplicateTemplate(source, [source])

    expect(result.folder).toBeUndefined()
  })
})
