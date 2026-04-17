import type { Model, Template } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { renderTemplate } from '../renderer'

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

describe('renderTemplate', () => {
  it('returns files from output cells', async () => {
    const tmpl = makeTemplate({ cells: [outputCell('file.txt')] })
    const files = await renderTemplate(tmpl, emptyModel)
    expect(files).toHaveLength(1)
    expect(files[0].outputPath).toContain('file.txt')
  })

  it('returns empty array when no output cells', async () => {
    const tmpl = makeTemplate({ cells: [logicCell('1 + 1')] })
    const files = await renderTemplate(tmpl, emptyModel)
    expect(files).toHaveLength(0)
  })
})
