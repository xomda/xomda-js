import type { Model, Template } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { executeTemplate } from '../engine'
import { renderTemplateByScope } from '../renderer'

function modelWith(entities: { name: string }[]): Model {
  return {
    id: 'm',
    name: 'M',
    version: '1.0.0',
    packages: [
      {
        id: 'p',
        name: 'pkg',
        packages: [],
        enums: [],
        entities: entities.map((e, i) => ({ id: `e-${i}`, name: e.name, attributes: [] })),
      },
    ],
  }
}

function tpl(cells: Template['cells']): Template {
  return { uuid: crypto.randomUUID(), name: 'T', version: '1.0.0', cells }
}

describe('loop cell hierarchy', () => {
  it('writes one file per iteration when the output is a child of the loop', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'entities',
        variableName: 'e',
        children: [
          { uuid: crypto.randomUUID(), type: 'handlebars', content: 'class {{e.name}} {}' },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: '{{e.name}}.txt',
          },
        ],
      },
    ])

    const files = await renderTemplateByScope(template, modelWith([{ name: 'A' }, { name: 'B' }]))
    expect(files).toHaveLength(2)
    const byPath = Object.fromEntries(files.map((f) => [f.outputPath, f.content]))
    expect(byPath['A.txt']).toBe('class A {}')
    expect(byPath['B.txt']).toBe('class B {}')
  })

  it('writes one combined file when the output is a sibling after the loop', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'entities',
        variableName: 'e',
        children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{e.name}}\n' }],
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'all.txt',
      },
    ])

    const files = await renderTemplateByScope(template, modelWith([{ name: 'A' }, { name: 'B' }]))
    expect(files).toHaveLength(1)
    expect(files[0].outputPath).toBe('all.txt')
    expect(files[0].content).toBe('A\nB\n')
  })

  it('supports loops nested inside loops', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'entities',
        variableName: 'e',
        children: [
          { uuid: crypto.randomUUID(), type: 'handlebars', content: '[{{e.name}}' },
          {
            uuid: crypto.randomUUID(),
            type: 'loop',
            content: '',
            loopSource: 'entities',
            variableName: 'inner',
            children: [
              { uuid: crypto.randomUUID(), type: 'handlebars', content: ' {{inner.name}}' },
            ],
          },
          { uuid: crypto.randomUUID(), type: 'handlebars', content: ']' },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: '{{e.name}}.txt',
          },
        ],
      },
    ])

    const files = await renderTemplateByScope(template, modelWith([{ name: 'A' }, { name: 'B' }]))
    expect(files).toHaveLength(2)
    const byPath = Object.fromEntries(files.map((f) => [f.outputPath, f.content]))
    expect(byPath['A.txt']).toBe('[A A B]')
    expect(byPath['B.txt']).toBe('[B A B]')
  })

  it('loop-logic cells use the cell content as a JavaScript generator', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop-logic',
        variableName: 'n',
        content: `function* provide() {
          yield 1
          yield 2
          yield 3
        }`,
        children: [
          { uuid: crypto.randomUUID(), type: 'handlebars', content: '{{n}}' },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: 'n-{{n}}.txt',
          },
        ],
      },
    ])

    const result = await executeTemplate(template, modelWith([]))
    expect(result.files.map((f) => f.outputPath).sort()).toEqual([
      'n-1.txt',
      'n-2.txt',
      'n-3.txt',
    ])
  })
})
