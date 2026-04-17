import type { Model, TemplateCell } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { bufferProcessor } from '../buffer'
import type { CellContext } from '../types'
import { CapturedConsole, OutputBuffer } from '../utils'

const model: Model = { id: 'm', name: 'M', version: '1.0.0', packages: [] }

function makeCtx(): CellContext {
  const $out = new OutputBuffer()
  return {
    model,
    scopeContext: {},
    helpers: {
      pascalCase: (s) => s,
      camelCase: (s) => s,
      snakeCase: (s) => s,
      kebabCase: (s) => s,
      constantCase: (s) => s,
      upperCase: (s) => s,
      lowerCase: (s) => s,
    },
    templateUuid: 'tpl',
    diff: undefined,
    variables: {},
    cellBuffers: [$out],
    files: [],
    $out,
    capturedConsole: new CapturedConsole(),
    state: { output: '', contextDiff: {}, consoleLogs: [], error: undefined, done: false },
  }
}

describe('bufferProcessor', () => {
  it('publishes a fresh OutputBuffer under the named variable', async () => {
    const ctx = makeCtx()
    const cell: TemplateCell = { uuid: 'c1', type: 'buffer', content: '', variableName: 'log' }
    await bufferProcessor.execute(cell, ctx)
    expect(ctx.state.contextDiff.log).toBeInstanceOf(OutputBuffer)
  })

  it('does nothing when variableName is missing/empty', async () => {
    const ctx = makeCtx()
    const cell: TemplateCell = { uuid: 'c1', type: 'buffer', content: '' }
    await bufferProcessor.execute(cell, ctx)
    expect(ctx.state.contextDiff).toEqual({})
  })

  it('interpolates variableName via handlebars (e.g. {{pascalCase ...}})', async () => {
    const ctx = makeCtx()
    const cell: TemplateCell = {
      uuid: 'c1',
      type: 'buffer',
      content: '',
      variableName: '{{name}}Log',
    }
    ;(ctx.scopeContext as Record<string, unknown>).name = 'demo'
    await bufferProcessor.execute(cell, ctx)
    expect(ctx.state.contextDiff.demoLog).toBeInstanceOf(OutputBuffer)
  })

  it('creates a buffer that writes/getContent in insertion order', async () => {
    const ctx = makeCtx()
    const cell: TemplateCell = { uuid: 'c1', type: 'buffer', content: '', variableName: 'log' }
    await bufferProcessor.execute(cell, ctx)
    const buf = ctx.state.contextDiff.log as OutputBuffer
    buf.write('a')
    buf.write('b')
    expect(buf.getContent()).toBe('ab')
  })
})
