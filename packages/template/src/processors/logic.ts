import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'
import type { CellContext } from './types'
import { createSandboxedFn } from './utils'

// Keys the user cannot overwrite — they are sealed to their initial values.
const SEALED_KEYS = new Set([
  'model', 'console', '$out', '$ctx',
  'pascalCase', 'camelCase', 'snakeCase', 'kebabCase', 'constantCase', 'upperCase', 'lowerCase',
])

function createCtxProxy(state: CellContext['state'], sealedKeys: Set<string>): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    set(_target, prop: string, value) {
      if (sealedKeys.has(prop)) {
        throw new Error(`Cannot overwrite sealed context key "${prop}"`)
      }
      state.contextDiff[prop] = value
      return true
    },
    get(_target, prop: string) {
      return state.contextDiff[prop]
    },
  })
}

export const logicProcessor = defineProcessor({
  type: 'logic',
  async execute(cell, ctx) {
    if (!cell.content.trim()) return

    const $ctx = createCtxProxy(ctx.state, SEALED_KEYS)

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
      $out: ctx.$out,
      console: ctx.capturedConsole,
      $ctx,
    }

    const paramNames = Object.keys(flatCtx)
    const paramValues = Object.values(flatCtx)
    const trimmed = cell.content.trim()
    const isSingleExpr =
      !trimmed.includes('return') &&
      !trimmed.includes(';') &&
      !trimmed.startsWith('throw') &&
      !trimmed.startsWith('if ') &&
      !trimmed.startsWith('if(')
    const body = isSingleExpr ? `return (${trimmed})` : trimmed
    const fn = createSandboxedFn(paramNames, body)
    const result = await fn(...paramValues)

    const varName = resolveField(cell.variableName, flatCtx)
    if (varName) {
      ctx.state.contextDiff[varName] = result
    }
  },
})
