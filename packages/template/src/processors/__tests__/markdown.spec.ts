import type { Model, TemplateCell } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { markdownProcessor } from '../markdown'
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

describe('markdownProcessor', () => {
  it('is a no-op — produces no output, no files, no context', async () => {
    const cell: TemplateCell = { uuid: 'c1', type: 'markdown', content: '# Heading\n\nText' }
    const ctx = makeCtx()
    await markdownProcessor.execute(cell, ctx)
    expect(ctx.$out.getContent()).toBe('')
    expect(ctx.files).toHaveLength(0)
    expect(ctx.state.contextDiff).toEqual({})
  })

  it('is registered with type "markdown"', () => {
    expect(markdownProcessor.type).toBe('markdown')
  })
})
