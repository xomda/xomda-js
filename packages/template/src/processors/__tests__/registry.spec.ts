import type { Model, Template, TemplateCell } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { createCellInstance, createExecutionContext, PROCESSORS } from '../registry'

const model: Model = { id: 'm', name: 'M', version: '1.0.0', packages: [] }

const template = (cells: TemplateCell[] = []): Template => ({
  uuid: 'tpl-1',
  name: 'T',
  version: '1.0.0',
  cells,
})

describe('PROCESSORS', () => {
  it('has an entry for every known CellType', () => {
    // Snapshot the set so adding/removing a cell type is an intentional act.
    expect(Object.keys(PROCESSORS).sort()).toEqual([
      'buffer',
      'handlebars',
      'logic',
      'loop',
      'loop-logic',
      'markdown',
      'output',
    ])
  })

  it('aliases loop and loop-logic to the same processor', () => {
    expect(PROCESSORS.loop).toBe(PROCESSORS['loop-logic'])
  })
})

describe('createExecutionContext', () => {
  it('initialises with model, empty variables, empty buffer/file lists', () => {
    const ctx = createExecutionContext(template(), model)
    expect(ctx.model).toBe(model)
    expect(ctx.variables).toEqual({})
    expect(ctx.cellBuffers).toEqual([])
    expect(ctx.files).toEqual([])
    expect(ctx.templateUuid).toBe('tpl-1')
    expect(ctx.diff).toBeUndefined()
  })

  it('threads scopeContext and helpers through', () => {
    const ctx = createExecutionContext(template(), model, { entity: { id: 'e1' } })
    expect(ctx.scopeContext).toEqual({ entity: { id: 'e1' } })
    expect(typeof ctx.helpers.pascalCase).toBe('function')
  })
})

describe('createCellInstance.execute', () => {
  it('captures errors from a throwing processor into state.error', async () => {
    const cell: TemplateCell = { uuid: 'c1', type: 'logic', content: 'throw new Error("boom")' }
    const instance = createCellInstance(cell)
    await instance.execute(createExecutionContext(template([cell]), model))
    expect(instance.state.error).toMatch(/boom/)
    expect(instance.state.done).toBe(true)
  })

  it('marks state.done=true even on success', async () => {
    const cell: TemplateCell = { uuid: 'c1', type: 'logic', content: '$out.write("hi")' }
    const instance = createCellInstance(cell)
    await instance.execute(createExecutionContext(template([cell]), model))
    expect(instance.state.done).toBe(true)
    expect(instance.state.error).toBeUndefined()
    expect(instance.state.output).toBe('hi')
  })

  it('merges contextDiff into execCtx.variables after run', async () => {
    const cell: TemplateCell = { uuid: 'c1', type: 'logic', content: 'value = 42' }
    const instance = createCellInstance(cell)
    const ctx = createExecutionContext(template([cell]), model)
    await instance.execute(ctx)
    expect(ctx.variables.value).toBe(42)
  })

  it('toCellOutput omits contextDiff/consoleLogs when empty', async () => {
    const cell: TemplateCell = { uuid: 'c1', type: 'logic', content: '' }
    const instance = createCellInstance(cell)
    await instance.execute(createExecutionContext(template([cell]), model))
    const out = instance.toCellOutput()
    expect(out.contextDiff).toBeUndefined()
    expect(out.consoleLogs).toBeUndefined()
    expect(out.uuid).toBe('c1')
  })

  it('toCellOutput surfaces non-empty contextDiff and consoleLogs', async () => {
    const cell: TemplateCell = {
      uuid: 'c1',
      type: 'logic',
      content: 'console.log("hello"); answer = 1',
    }
    const instance = createCellInstance(cell)
    await instance.execute(createExecutionContext(template([cell]), model))
    const out = instance.toCellOutput()
    expect(out.consoleLogs).toEqual(['hello'])
    expect(out.contextDiff).toEqual({ answer: 1 })
  })
})
