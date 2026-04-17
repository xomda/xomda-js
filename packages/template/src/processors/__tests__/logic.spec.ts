import type { Model, TemplateCell } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { logicProcessor } from '../logic'
import type { CellContext } from '../types'
import { CapturedConsole, OutputBuffer } from '../utils'

const model: Model = { id: 'm', name: 'M', version: '1.0.0', packages: [] }

function makeCtx(overrides: Partial<CellContext> = {}): CellContext {
  const $out = new OutputBuffer()
  return {
    model,
    scopeContext: {},
    helpers: {
      pascalCase: (s: string) => s,
      camelCase: (s: string) => s,
      snakeCase: (s: string) => s,
      kebabCase: (s: string) => s,
      constantCase: (s: string) => s,
      upperCase: (s: string) => s,
      lowerCase: (s: string) => s,
    },
    templateUuid: 'tpl',
    diff: undefined,
    variables: {},
    cellBuffers: [$out],
    files: [],
    $out,
    capturedConsole: new CapturedConsole(),
    state: { output: '', contextDiff: {}, consoleLogs: [], error: undefined, done: false },
    ...overrides,
  }
}

const cell = (content: string): TemplateCell => ({ uuid: 'c1', type: 'logic', content })

describe('logicProcessor', () => {
  it('returns early without running when content is empty/whitespace', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('   '), ctx)
    expect(ctx.state.contextDiff).toEqual({})
    expect(ctx.$out.getContent()).toBe('')
  })

  it('exposes $out to write into', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('$out.write("hello")'), ctx)
    expect(ctx.$out.getContent()).toBe('hello')
  })

  it('captures console.log into the captured console', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('console.log("hi", 1)'), ctx)
    expect(ctx.capturedConsole.logs).toEqual(['hi 1'])
  })

  it('exposes the model object', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('$out.write(model.name)'), ctx)
    expect(ctx.$out.getContent()).toBe('M')
  })

  it('exposes scopeContext fields as bare identifiers', async () => {
    const ctx = makeCtx({ scopeContext: { entity: { name: 'Customer' } } })
    await logicProcessor.execute(cell('$out.write(entity.name)'), ctx)
    expect(ctx.$out.getContent()).toBe('Customer')
  })

  it('exposes casing helpers as bare identifiers', async () => {
    const ctx = makeCtx({
      helpers: { ...makeCtx().helpers, pascalCase: (s: string) => `P_${s}` },
    })
    await logicProcessor.execute(cell('$out.write(pascalCase("x"))'), ctx)
    expect(ctx.$out.getContent()).toBe('P_x')
  })

  it('publishes bare assignments into contextDiff', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('answer = 42'), ctx)
    expect(ctx.state.contextDiff.answer).toBe(42)
  })

  it('supports $ctx as an alias for the scope (back-compat)', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('$ctx.answer = 7'), ctx)
    expect(ctx.state.contextDiff.answer).toBe(7)
  })

  it('does NOT leak let/const declarations into contextDiff', async () => {
    // `var` is function-scoped and hoists out of the `with(scope)` block, so
    // it lands in contextDiff via the proxy's set trap — that's documented
    // sandbox behaviour. let/const are block-scoped and stay local.
    const ctx = makeCtx()
    await logicProcessor.execute(cell('let local = 1; const fixed = 2'), ctx)
    expect(ctx.state.contextDiff).toEqual({})
  })

  it('refuses to overwrite sealed keys', async () => {
    const ctx = makeCtx()
    await expect(
      (async () => {
        await logicProcessor.execute(cell('model = {}'), ctx)
      })()
    ).rejects.toThrow(/sealed/i)
  })

  it('shadows browser globals (window/document) so they read as undefined', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(
      cell('$out.write(String(typeof window) + "/" + String(typeof document))'),
      ctx
    )
    expect(ctx.$out.getContent()).toBe('undefined/undefined')
  })

  it('still resolves host built-ins (Array, JSON, Math, Promise) through the proxy', async () => {
    const ctx = makeCtx()
    await logicProcessor.execute(cell('$out.write(JSON.stringify([1, Math.max(2, 3)]))'), ctx)
    expect(ctx.$out.getContent()).toBe('[1,3]')
  })

  it('cell body runs synchronously — top-level await is not supported (logic uses Function, not AsyncFunction)', async () => {
    const ctx = makeCtx()
    // Synchronous Promise composition is fine — we just can't use `await` at
    // the top level of the cell body.
    await logicProcessor.execute(cell('answer = Promise.resolve(42)'), ctx)
    expect(ctx.state.contextDiff.answer).toBeInstanceOf(Promise)
    expect(await (ctx.state.contextDiff.answer as Promise<number>)).toBe(42)
  })
})
