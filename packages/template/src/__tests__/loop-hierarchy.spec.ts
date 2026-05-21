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

  it('loop-logic cells use the cell content as a JavaScript generator (return value)', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop-logic',
        variableName: 'n',
        content: `return function* () {
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
    expect(result.files.map((f) => f.outputPath).sort()).toEqual(['n-1.txt', 'n-2.txt', 'n-3.txt'])
  })

  it('returned generator function receives model as its collection arg at top level', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop-logic',
        variableName: 'name',
        content: `return function* (collection) {
          for (const pkg of (collection.packages ?? [])) {
            for (const e of (pkg.entities ?? [])) yield e.name
          }
        }`,
        children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{name}}\n' }],
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'all.txt',
      },
    ])

    const result = await executeTemplate(template, modelWith([{ name: 'A' }, { name: 'B' }]))
    expect(result.files).toHaveLength(1)
    expect(result.files[0].content).toBe('A\nB\n')
  })

  it('nested generator receives the parent item and index', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        loopSource: 'entities',
        variableName: 'e',
        content: '',
        children: [
          {
            uuid: crypto.randomUUID(),
            type: 'loop-logic',
            variableName: 'tag',
            content: `return function* (item, index) {
              yield item.name + ':' + index
            }`,
            children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{tag}}\n' }],
          },
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
    const byPath = Object.fromEntries(files.map((f) => [f.outputPath, f.content]))
    expect(byPath['A.txt']).toBe('A:0\n')
    expect(byPath['B.txt']).toBe('B:1\n')
  })

  it('code block returning an iterable directly is iterated as-is', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop-logic',
        variableName: 'x',
        content: `return [10, 20, 30]`,
        children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{x}},' }],
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
      },
    ])

    const result = await executeTemplate(template, modelWith([]))
    expect(result.files[0].content).toBe('10,20,30,')
  })

  it('setup code can mutate $ctx before returning the generator', async () => {
    const template = tpl([
      {
        uuid: crypto.randomUUID(),
        type: 'loop-logic',
        variableName: 'v',
        content: `
          $ctx.prefix = 'P'
          return function* () {
            yield $ctx.prefix + '1'
            yield $ctx.prefix + '2'
          }
        `,
        children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{v}},' }],
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
      },
    ])

    const result = await executeTemplate(template, modelWith([]))
    expect(result.files[0].content).toBe('P1,P2,')
  })

  describe('workspace-scope loop sources', () => {
    it('models loop falls back to a singleton when allModels is omitted', async () => {
      const template = tpl([
        {
          uuid: crypto.randomUUID(),
          type: 'loop',
          content: '',
          loopSource: 'models',
          variableName: 'm',
          children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{m.name}};' }],
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const result = await executeTemplate(template, modelWith([{ name: 'A' }]))
      // Singleton: exactly one iteration, with the active model's name.
      expect(result.files[0].content).toBe('M;')
    })

    it('nested entities loop inside a models loop sees each iterated model', async () => {
      // The load-bearing test for the engine scope swap: when iterating
      // `models`, child loops over `entities` must resolve against the
      // iterated model — not the outer one.
      const modelA: Model = {
        id: 'a',
        name: 'A',
        version: '1.0.0',
        packages: [
          {
            id: 'p-a',
            name: 'pa',
            packages: [],
            enums: [],
            entities: [{ id: 'e-a-1', name: 'A1', attributes: [] }],
          },
        ],
      }
      const modelB: Model = {
        id: 'b',
        name: 'B',
        version: '1.0.0',
        packages: [
          {
            id: 'p-b',
            name: 'pb',
            packages: [],
            enums: [],
            entities: [
              { id: 'e-b-1', name: 'B1', attributes: [] },
              { id: 'e-b-2', name: 'B2', attributes: [] },
            ],
          },
        ],
      }
      const template = tpl([
        {
          uuid: crypto.randomUUID(),
          type: 'loop',
          content: '',
          loopSource: 'models',
          variableName: 'm',
          children: [
            { uuid: crypto.randomUUID(), type: 'handlebars', content: '[{{m.name}}:' },
            {
              uuid: crypto.randomUUID(),
              type: 'loop',
              content: '',
              loopSource: 'entities',
              variableName: 'e',
              children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{e.name}},' }],
            },
            { uuid: crypto.randomUUID(), type: 'handlebars', content: ']' },
          ],
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const result = await executeTemplate(template, modelA, {}, undefined, {
        allModels: [modelA, modelB],
      })
      // Outer iteration: model A → A1. Outer iteration: model B → B1, B2.
      expect(result.files[0].content).toBe('[A:A1,][B:B1,B2,]')
    })

    it('projects loop falls back to a synthetic singleton when allProjects is omitted', async () => {
      const template = tpl([
        {
          uuid: crypto.randomUUID(),
          type: 'loop',
          content: '',
          loopSource: 'projects',
          variableName: 'p',
          children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{p.name}};' }],
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const result = await executeTemplate(template, modelWith([]))
      expect(result.files[0].content).toBe('current;')
    })

    it('projects loop iterates supplied projects without swapping model context', async () => {
      const modelA: Model = {
        id: 'a',
        name: 'A',
        version: '1.0.0',
        packages: [
          {
            id: 'p-a',
            name: 'pa',
            packages: [],
            enums: [],
            entities: [{ id: 'e-a', name: 'OuterEntity', attributes: [] }],
          },
        ],
      }
      const modelB: Model = {
        id: 'b',
        name: 'B',
        version: '1.0.0',
        packages: [
          {
            id: 'p-b',
            name: 'pb',
            packages: [],
            enums: [],
            entities: [{ id: 'e-b', name: 'InnerEntity', attributes: [] }],
          },
        ],
      }
      const template = tpl([
        {
          uuid: crypto.randomUUID(),
          type: 'loop',
          content: '',
          loopSource: 'projects',
          variableName: 'p',
          children: [
            // Without a swap, this resolves against the outer (active) model.
            { uuid: crypto.randomUUID(), type: 'handlebars', content: '{{p.name}}>' },
            {
              uuid: crypto.randomUUID(),
              type: 'loop',
              content: '',
              loopSource: 'entities',
              variableName: 'e',
              children: [{ uuid: crypto.randomUUID(), type: 'handlebars', content: '{{e.name}};' }],
            },
          ],
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const result = await executeTemplate(template, modelA, {}, undefined, {
        allProjects: [
          { root: '/x/one', name: 'one', isRoot: true, models: [modelA] },
          { root: '/x/two', name: 'two', isRoot: false, models: [modelB] },
        ],
      })
      // The active model stays modelA inside the projects loop (no swap),
      // so both project iterations see OuterEntity from modelA.
      expect(result.files[0].content).toBe('one>OuterEntity;two>OuterEntity;')
    })
  })
})
