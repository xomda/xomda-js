import type { Model, ModelDiff, Template } from '@xomda/core'
import { emptyModelDiff } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { executeTemplate } from '../engine'
import { renderTemplateByScope } from '../renderer'

const emptyModel: Model = {
  id: 'test-model',
  name: 'TestModel',
  version: '1.0.0',
  packages: [],
}

function makeTemplate(cells: Template['cells']): Template {
  return { uuid: crypto.randomUUID(), name: 'Test', version: '1.0.0', cells }
}

describe('ctx.diff exposure', () => {
  it('exposes ctx.diff to logic cells when a diff is provided', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'logic',
        content: 'addedCount = diff.added.entities.length',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'handlebars',
        content: '{{addedCount}}',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
      },
    ])

    const diff: ModelDiff = emptyModelDiff()
    diff.added.entities.push({
      entity: { id: 'e-1', name: 'Order', attributes: [] },
      packageId: 'p-1',
      packageName: 'p',
    })

    const result = await executeTemplate(template, emptyModel, {}, diff)
    expect(result.files[0].content).toBe('1')
  })

  it('passes undefined diff through cleanly when not provided', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'logic',
        content: 'hasDiff = diff !== undefined',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'handlebars',
        content: '{{hasDiff}}',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
      },
    ])
    const result = await executeTemplate(template, emptyModel)
    expect(result.files[0].content).toBe('false')
  })
})

describe('diff loopSource iteration', () => {
  it('iterates one render per added entity', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'diff-added-entities',
        variableName: 'item',
        children: [
          {
            uuid: crypto.randomUUID(),
            type: 'handlebars',
            content: 'CREATE TABLE {{entity.name}};',
          },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: '{{entity.name}}.sql',
          },
        ],
      },
    ])

    const diff: ModelDiff = emptyModelDiff()
    diff.added.entities.push(
      {
        entity: { id: 'e-1', name: 'Order', attributes: [] },
        packageId: 'p-1',
        packageName: 'p',
      },
      {
        entity: { id: 'e-2', name: 'Customer', attributes: [] },
        packageId: 'p-1',
        packageName: 'p',
      }
    )

    const files = await renderTemplateByScope(template, emptyModel, diff)
    expect(files).toHaveLength(2)
    const names = files.map((f) => f.outputPath).sort()
    expect(names).toEqual(['Customer.sql', 'Order.sql'])
    expect(files[0].content).toContain('CREATE TABLE')
  })

  it('emits zero files when diff is undefined and loopSource is a diff source', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'diff-modified-attributes',
        variableName: 'item',
        children: [
          {
            uuid: crypto.randomUUID(),
            type: 'handlebars',
            content: 'never',
          },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: 'out.sql',
          },
        ],
      },
    ])

    const files = await renderTemplateByScope(template, emptyModel)
    expect(files).toHaveLength(0)
  })

  it('iterates modified attributes with before/after exposed', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'loop',
        content: '',
        loopSource: 'diff-modified-attributes',
        variableName: 'item',
        children: [
          {
            uuid: crypto.randomUUID(),
            type: 'handlebars',
            content: 'ALTER {{before.type}} -> {{after.type}}',
          },
          {
            uuid: crypto.randomUUID(),
            type: 'output',
            content: '',
            outputFilename: '{{entityName}}.{{after.name}}.sql',
          },
        ],
      },
    ])

    const diff: ModelDiff = emptyModelDiff()
    diff.modified.attributes.push({
      id: 'a-1',
      before: { id: 'a-1', name: 'email', type: 'string', required: false, multiValue: false, primaryKey: false, unique: false },
      after: { id: 'a-1', name: 'email', type: 'text', required: false, multiValue: false, primaryKey: false, unique: false },
      changes: ['type'],
      entityId: 'e-1',
      entityName: 'User',
    })

    const files = await renderTemplateByScope(template, emptyModel, diff)
    expect(files).toHaveLength(1)
    expect(files[0].outputPath).toBe('User.email.sql')
    expect(files[0].content).toBe('ALTER string -> text')
  })
})
