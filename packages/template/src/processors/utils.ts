import { casingHelpers } from '../casingHelpers'

export class OutputBuffer {
  private chunks: string[] = []

  write(chunk: string): void {
    this.chunks.push(chunk)
  }

  getContent(): string {
    return this.chunks.join('')
  }

  toString(): string {
    return this.getContent()
  }
}

export class CapturedConsole {
  readonly logs: string[] = []

  log(...args: unknown[]): void {
    this.logs.push(args.map(safeStringify).join(' '))
  }
  warn(...args: unknown[]): void {
    this.logs.push(`[warn] ${args.map(safeStringify).join(' ')}`)
  }
  error(...args: unknown[]): void {
    this.logs.push(`[error] ${args.map(safeStringify).join(' ')}`)
  }
  info(...args: unknown[]): void {
    this.logs.push(`[info] ${args.map(safeStringify).join(' ')}`)
  }
}

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2) ?? String(v)
  } catch {
    return String(v)
  }
}

// Globals shadowed in user code so the cell function has no convenient DOM
// or browser-API access. **This is NOT a security sandbox.** `eval` and
// `Function` cannot be used as parameter names in strict mode, so a
// determined cell can still reach the global scope via `Function('return this')`
// or `(0, eval)('this')`. Treat templates the same way you treat
// `package.json#scripts`: code authored by the project owner. Importing a
// template from an untrusted source has the same threat model as running an
// arbitrary npm script.
export const TEMPLATE_FN_BLOCKED_GLOBALS = [
  'window',
  'document',
  'globalThis',
  'self',
  'top',
  'parent',
  'frames',
  'location',
  'navigator',
  'history',
  'screen',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'SharedWorker',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'alert',
  'confirm',
  'prompt',
  'open',
  'close',
  'postMessage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
]

type TemplateFn = (...args: unknown[]) => unknown

const TEMPLATE_FN_CACHE = new Map<string, TemplateFn>()
const TEMPLATE_FN_CACHE_MAX = 256

/**
 * Compile a template cell's JS body into a callable function.
 *
 * **Not a security boundary.** The function shadows common DOM/browser
 * globals (`window`, `document`, `fetch`, `localStorage`, …) by binding
 * each name to `undefined` via the parameter list — that catches casual
 * misuse, but `eval` and `Function` can't be shadowed this way (strict
 * mode forbids them as parameter names), and `new Function('return this')()`
 * still reaches the global scope. Treat templates as code authored by the
 * project owner — the threat model is the same as `package.json#scripts`.
 *
 * Compiled functions are LRU-cached by `(paramNames, body, strict)` so
 * repeated cell renders amortise the `new Function(...)` cost.
 *
 * `strict: true` (default) emits `"use strict";` at the top of the body —
 * the only mode used by `loop` / `loop-logic`. The `logic` cell uses
 * `strict: false` so user code can declare top-level `var X = ...` and
 * pick them up across cells.
 */
export function createTemplateFn(
  paramNames: string[],
  body: string,
  options: { strict?: boolean } = {}
): TemplateFn {
  const strict = options.strict ?? true
  // Cache key must capture every input that affects fn identity. `paramNames`
  // order matters (positional args); strict mode affects semantics.
  const cacheKey = `${strict ? '1' : '0'}|${paramNames.join(',')}|${body}`
  const cached = TEMPLATE_FN_CACHE.get(cacheKey)
  if (cached) return cached

  const blocked = TEMPLATE_FN_BLOCKED_GLOBALS.filter((name) => !paramNames.includes(name))
  const prelude = strict ? '"use strict";\n' : ''
  const fn = new Function(...blocked, ...paramNames, `${prelude}${body}`)
  const blockedUndefineds = blocked.map(() => undefined)
  const wrapped: TemplateFn = (...values: unknown[]) => fn(...blockedUndefineds, ...values)

  if (TEMPLATE_FN_CACHE.size >= TEMPLATE_FN_CACHE_MAX) {
    // Cheap FIFO eviction — first key is oldest insertion.
    const oldest = TEMPLATE_FN_CACHE.keys().next().value
    if (oldest !== undefined) TEMPLATE_FN_CACHE.delete(oldest)
  }
  TEMPLATE_FN_CACHE.set(cacheKey, wrapped)
  return wrapped
}

/** Test-only: drop the compiled-fn cache. Not part of the public API. */
export function __clearTemplateFnCacheForTests(): void {
  TEMPLATE_FN_CACHE.clear()
}

export type Helpers = ReturnType<typeof buildHelpers>

export function buildHelpers() {
  return { ...casingHelpers }
}
