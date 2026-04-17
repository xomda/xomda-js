import type { Model, Template } from '@xomda/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderTemplateByScope } from '../renderer'
import * as storage from '../storage'

const emptyModel: Model = {
  id: 'test-model',
  name: 'TestModel',
  version: '1.0.0',
  packages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  elementsOrder: [],
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
    outputFilename: filename,
    outputDirectory: 'out',
  }
}

function logicCell(content: string, variableName?: string): Template['cells'][0] {
  return { uuid: crypto.randomUUID(), type: 'logic', content, variableName }
}

afterEach(() => vi.restoreAllMocks())

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
          entities: [{ uuid: crypto.randomUUID(), name: 'A', id: crypto.randomUUID(), attributes: [] }],
          enums: [],
          packages: [
            {
              id: crypto.randomUUID(),
              name: 'inner',
              entities: [{ uuid: crypto.randomUUID(), name: 'B', id: crypto.randomUUID(), attributes: [] }],
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

describe('resolveInheritance (via renderTemplateByScope)', () => {
  it('prepends parent cells before child cells', async () => {
    const parentUuid = crypto.randomUUID()
    const parent = makeTemplate({
      uuid: parentUuid,
      cells: [logicCell('$out.write("parent")')],
    })
    const child = makeTemplate({
      extends: parentUuid,
      cells: [logicCell('$out.write("child")'), outputCell('out.txt')],
    })

    vi.spyOn(storage, 'readTemplate').mockResolvedValue(parent)

    const files = await renderTemplateByScope(child, emptyModel)
    expect(files).toHaveLength(1)
    expect(files[0].content).toContain('parent')
    expect(files[0].content).toContain('child')
  })

  it('handles missing parent gracefully', async () => {
    const child = makeTemplate({
      extends: crypto.randomUUID(),
      cells: [outputCell('out.txt')],
    })
    vi.spyOn(storage, 'readTemplate').mockRejectedValue(new Error('not found'))

    const files = await renderTemplateByScope(child, emptyModel)
    expect(files).toHaveLength(1)
  })

  it('guards against circular references', async () => {
    const aUuid = crypto.randomUUID()
    const bUuid = crypto.randomUUID()
    const a = makeTemplate({ uuid: aUuid, extends: bUuid, cells: [outputCell('a.txt')] })
    const b = makeTemplate({ uuid: bUuid, extends: aUuid, cells: [] })

    vi.spyOn(storage, 'readTemplate').mockImplementation(async (uuid: string) => {
      if (uuid === aUuid) return a
      if (uuid === bUuid) return b
      throw new Error('not found')
    })

    const files = await renderTemplateByScope(a, emptyModel)
    expect(Array.isArray(files)).toBe(true)
  })

  it('resolves multi-level inheritance (grandparent → parent → child)', async () => {
    const gpUuid = crypto.randomUUID()
    const pUuid = crypto.randomUUID()

    const grandparent = makeTemplate({ uuid: gpUuid, cells: [logicCell('$out.write("gp")')] })
    const parent = makeTemplate({
      uuid: pUuid,
      extends: gpUuid,
      cells: [logicCell('$out.write("p")')],
    })
    const child = makeTemplate({
      extends: pUuid,
      cells: [logicCell('$out.write("c")'), outputCell('out.txt')],
    })

    vi.spyOn(storage, 'readTemplate').mockImplementation(async (uuid: string) => {
      if (uuid === gpUuid) return grandparent
      if (uuid === pUuid) return parent
      throw new Error('not found')
    })

    const files = await renderTemplateByScope(child, emptyModel)
    expect(files).toHaveLength(1)
    expect(files[0].content).toContain('gp')
    expect(files[0].content).toContain('p')
    expect(files[0].content).toContain('c')
  })
})
