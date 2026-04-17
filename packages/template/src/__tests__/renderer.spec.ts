import type { Model, Template } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { renderTemplateByScope } from '../renderer'

const emptyModel: Model = {
  id: 'test-model',
  name: 'TestModel',
  version: '1.0.0',
  packages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    uuid: crypto.randomUUID(),
    name: 'Test',
    version: '1.0.0',
    cells: [],
    ...overrides,
  }
}

function outputCell(filename: string): Template['cells'][0] {
  return {
    uuid: crypto.randomUUID(),
    type: 'output',
    content: '',
    outputFilename: `out/${filename}`,
  }
}

function logicCell(content: string): Template['cells'][0] {
  return { uuid: crypto.randomUUID(), type: 'logic', content }
}

describe('renderTemplateByScope — no scope', () => {
  it('returns files from output cells', async () => {
    const tmpl = makeTemplate({ cells: [outputCell('file.txt')] })
    const files = await renderTemplateByScope(tmpl, emptyModel)
    expect(files).toHaveLength(1)
    expect(files[0].outputPath).toContain('file.txt')
  })

  it('returns empty array when no output cells', async () => {
    const tmpl = makeTemplate({ cells: [logicCell('1 + 1')] })
    const files = await renderTemplateByScope(tmpl, emptyModel)
    expect(files).toHaveLength(0)
  })
})

describe('renderTemplateByScope — Entity scope', () => {
  it('renders one file per entity across all packages', async () => {
    const entityUuid = crypto.randomUUID()
    const model: Model = {
      ...emptyModel,
      packages: [
        {
          id: crypto.randomUUID(),
          name: 'pkg',
          entities: [{ uuid: entityUuid, name: 'User', id: crypto.randomUUID(), attributes: [] }],
          enums: [],
          packages: [],
        },
      ],
    }
    const tmpl = makeTemplate({
      scope: 'Entity',
      cells: [outputCell('entity.txt')],
    })
    const files = await renderTemplateByScope(tmpl, model)
    expect(files).toHaveLength(1)
  })

  it('renders entities from nested packages', async () => {
    const model: Model = {
      ...emptyModel,
      packages: [
        {
          id: crypto.randomUUID(),
          name: 'outer',
          entities: [
            { uuid: crypto.randomUUID(), name: 'A', id: crypto.randomUUID(), attributes: [] },
          ],
          enums: [],
          packages: [
            {
              id: crypto.randomUUID(),
              name: 'inner',
              entities: [
                { uuid: crypto.randomUUID(), name: 'B', id: crypto.randomUUID(), attributes: [] },
              ],
              enums: [],
              packages: [],
            },
          ],
        },
      ],
    }
    const tmpl = makeTemplate({
      scope: 'Entity',
      cells: [outputCell('entity.txt')],
    })
    const files = await renderTemplateByScope(tmpl, model)
    expect(files).toHaveLength(2)
  })
})
