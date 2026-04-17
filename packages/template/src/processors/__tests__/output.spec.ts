import type { Model, TemplateCell } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { outputProcessor } from '../output'
import type { CellContext } from '../types'
import { CapturedConsole, OutputBuffer } from '../utils'

const model: Model = { id: 'm', name: 'M', version: '1.0.0', packages: [] }

function makeCtx(priorContent: string[] = []): CellContext {
  // The output processor expects the last cellBuffer to be its own $out, and
  // sums everything before it as the upstream content.
  const cellBuffers = priorContent.map((c) => {
    const b = new OutputBuffer()
    b.write(c)
    return b
  })
  const $out = new OutputBuffer()
  cellBuffers.push($out)

  return {
    model,
    scopeContext: {},
    helpers: {
      pascalCase: (s: string) => s.toUpperCase(),
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
    cellBuffers,
    files: [],
    $out,
    capturedConsole: new CapturedConsole(),
    state: { output: '', contextDiff: {}, consoleLogs: [], error: undefined, done: false },
  }
}

const cell = (overrides: Partial<TemplateCell> = {}): TemplateCell => ({
  uuid: 'c1',
  type: 'output',
  content: '',
  outputType: 'file',
  outputFilename: 'out.txt',
  ...overrides,
})

describe('outputProcessor — file mode', () => {
  it('emits the accumulated upstream content to files[]', async () => {
    const ctx = makeCtx(['hello ', 'world'])
    await outputProcessor.execute(cell(), ctx)
    expect(ctx.files).toHaveLength(1)
    expect(ctx.files[0]).toEqual({
      templateId: 'tpl',
      outputPath: 'out.txt',
      content: 'hello world',
    })
  })

  it('writes the content to its own $out so a wrapping loop can aggregate it', async () => {
    const ctx = makeCtx(['hello'])
    await outputProcessor.execute(cell(), ctx)
    expect(ctx.$out.getContent()).toBe('hello')
  })

  it('consumes upstream cellBuffers (clears them) so the outer scope does not re-emit', async () => {
    const ctx = makeCtx(['a', 'b'])
    await outputProcessor.execute(cell(), ctx)
    // After execute, only the output cell's own $out remains.
    expect(ctx.cellBuffers).toHaveLength(1)
    expect(ctx.cellBuffers[0]).toBe(ctx.$out)
  })

  it('interpolates outputFilename via Handlebars', async () => {
    const ctx = makeCtx(['x'])
    ;(ctx.scopeContext as Record<string, unknown>).entity = { name: 'user profile' }
    // pascalCase resolves through the Handlebars helper registry, not ctx.helpers.
    await outputProcessor.execute(cell({ outputFilename: '{{pascalCase entity.name}}.ts' }), ctx)
    expect(ctx.files[0].outputPath).toBe('UserProfile.ts')
  })

  it('does not push a file when outputFilename is missing (still consumes buffers)', async () => {
    const ctx = makeCtx(['x'])
    await outputProcessor.execute(cell({ outputFilename: undefined }), ctx)
    expect(ctx.files).toHaveLength(0)
    // Still consumes upstream
    expect(ctx.cellBuffers).toHaveLength(1)
  })

  it('defaults outputType to "file" when unset', async () => {
    const ctx = makeCtx(['x'])
    await outputProcessor.execute(cell({ outputType: undefined }), ctx)
    expect(ctx.files).toHaveLength(1)
  })
})

describe('outputProcessor — context mode', () => {
  it('exposes the accumulated content as a named variable instead of a file', async () => {
    const ctx = makeCtx(['hello'])
    await outputProcessor.execute(
      cell({ outputType: 'context', outputContent: 'preamble', outputFilename: undefined }),
      ctx
    )
    expect(ctx.files).toHaveLength(0)
    expect(ctx.variables.preamble).toBe('hello')
  })

  it('does NOT clear upstream buffers (snapshot, non-consuming)', async () => {
    const ctx = makeCtx(['a', 'b'])
    const initial = ctx.cellBuffers.length
    await outputProcessor.execute(cell({ outputType: 'context', outputContent: 'snap' }), ctx)
    expect(ctx.cellBuffers).toHaveLength(initial)
  })

  it('is a no-op when outputContent is missing', async () => {
    const ctx = makeCtx(['x'])
    await outputProcessor.execute(cell({ outputType: 'context', outputContent: undefined }), ctx)
    expect(ctx.variables).toEqual({})
    expect(ctx.files).toHaveLength(0)
  })
})
