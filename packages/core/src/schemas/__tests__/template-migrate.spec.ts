import { describe, expect, it } from 'vitest'

import { TemplateSchema } from '../template.schema'
import { normalizeTemplate } from '../template-migrate'

describe('normalizeTemplate', () => {
  it('renames provider -> loop and providerSource -> loopSource', () => {
    const out = normalizeTemplate({
      uuid: 't-1',
      name: 't',
      cells: [
        { uuid: 'a', type: 'provider', content: '', providerSource: 'entities', variableName: 'e' },
      ],
    }) as { cells: { type: string; loopSource?: string; providerSource?: string }[] }
    expect(out.cells[0].type).toBe('loop')
    expect(out.cells[0].loopSource).toBe('entities')
    expect(out.cells[0].providerSource).toBeUndefined()
  })

  it('renames provider-logic -> loop-logic', () => {
    const out = normalizeTemplate({
      uuid: 't-1',
      name: 't',
      cells: [{ uuid: 'a', type: 'provider-logic', content: 'function* provide(){}' }],
    }) as { cells: { type: string }[] }
    expect(out.cells[0].type).toBe('loop-logic')
  })

  it('nests siblings after a top-level loop as its children', () => {
    const out = normalizeTemplate({
      uuid: 't-1',
      name: 't',
      cells: [
        { uuid: 'a', type: 'provider', content: '', providerSource: 'entities' },
        { uuid: 'b', type: 'handlebars', content: '{{name}}' },
        { uuid: 'c', type: 'output', content: '', outputFilename: '{{name}}.txt' },
      ],
    }) as { cells: { uuid: string; type: string; children?: { uuid: string }[] }[] }
    expect(out.cells).toHaveLength(1)
    expect(out.cells[0].type).toBe('loop')
    expect(out.cells[0].children?.map((c) => c.uuid)).toEqual(['b', 'c'])
  })

  it('leaves already-hierarchical templates alone (no double-nesting)', () => {
    const input = {
      uuid: 't-1',
      name: 't',
      cells: [
        {
          uuid: 'a',
          type: 'loop',
          content: '',
          loopSource: 'entities',
          children: [{ uuid: 'b', type: 'handlebars', content: '' }],
        },
      ],
    }
    const out = normalizeTemplate(input) as { cells: { children?: unknown[] }[] }
    expect(out.cells[0].children).toHaveLength(1)
  })

  it('is a no-op for non-template inputs', () => {
    expect(normalizeTemplate(null)).toBeNull()
    expect(normalizeTemplate('hi')).toBe('hi')
    expect(normalizeTemplate({ no: 'cells' })).toEqual({ no: 'cells' })
  })
})

describe('TemplateSchema.disabled', () => {
  const baseUuid = '00000000-0000-4000-8000-000000000001'

  it('defaults to undefined when omitted (treated as enabled)', () => {
    const parsed = TemplateSchema.parse({
      uuid: baseUuid,
      name: 't',
      cells: [],
    })
    expect(parsed.disabled).toBeUndefined()
  })

  it('round-trips disabled=true', () => {
    const parsed = TemplateSchema.parse({
      uuid: baseUuid,
      name: 't',
      cells: [],
      disabled: true,
    })
    expect(parsed.disabled).toBe(true)
  })

  it('round-trips disabled=false', () => {
    const parsed = TemplateSchema.parse({
      uuid: baseUuid,
      name: 't',
      cells: [],
      disabled: false,
    })
    expect(parsed.disabled).toBe(false)
  })
})
