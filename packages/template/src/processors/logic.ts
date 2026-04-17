import { defineProcessor } from './defineProcessor'
import type { CellContext } from './types'
import { createSandboxedFn, SANDBOX_BLOCKED } from './utils'

// Keys the user cannot overwrite — they are sealed to their initial values.
const SEALED_KEYS = new Set([
  'model', 'diff', 'console', '$out', '$ctx',
  'pascalCase', 'camelCase', 'snakeCase', 'kebabCase', 'constantCase', 'upperCase', 'lowerCase',
])

const BLOCKED_GLOBALS = new Set(SANDBOX_BLOCKED)

function createScopeProxy(
  state: CellContext['state'],
  flatCtx: Record<string, unknown>,
  sealedKeys: Set<string>,
): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    // Trap every name lookup inside `with(scope)` so bare identifiers
    // resolve through this proxy. Symbol.unscopables is intentionally not
    // trapped so engines that consult it get the default behavior.
    has(_target, prop) {
      if (typeof prop === 'symbol') return false
      return true
    },
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined
      if (prop in state.contextDiff) return state.contextDiff[prop]
      if (prop in flatCtx) return flatCtx[prop]
      // Sandbox: shadow the same globals the strict-mode sandbox blocks.
      if (BLOCKED_GLOBALS.has(prop)) return undefined
      // Fall back to host built-ins (Error, Array, JSON, Math, Promise, …)
      // so user code in `with(scope)` still resolves them.
      return (globalThis as Record<string, unknown>)[prop]
    },
    set(_target, prop, value) {
      if (typeof prop === 'symbol') return false
      if (sealedKeys.has(prop)) {
        throw new Error(`Cannot overwrite sealed context key "${prop}"`)
      }
      state.contextDiff[prop] = value
      return true
    },
  })
}

export const logicProcessor = defineProcessor({
  type: 'logic',
  async execute(cell, ctx) {
    if (!cell.content.trim()) return

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      diff: ctx.diff,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
      $out: ctx.$out,
      console: ctx.capturedConsole,
    }

    const scope = createScopeProxy(ctx.state, flatCtx, SEALED_KEYS)
    // $ctx is the same proxy — back-compat for `$ctx.foo = …` while bare
    // assignment (`foo = …`) is now the preferred way to expose values.
    flatCtx.$ctx = scope

    // Sloppy mode + `with (scope)` lets undeclared assignments land in the
    // proxy's `set` trap (→ contextDiff). `let`/`const`/`var` declarations
    // stay lexically scoped to the function and are not exposed.
    const body = `with (scope) {\n${cell.content}\n}`
    const fn = createSandboxedFn(['scope'], body, { strict: false })
    await fn(scope)
  },
})
