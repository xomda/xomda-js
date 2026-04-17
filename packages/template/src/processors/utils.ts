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

// Globals to shadow in user code so the sandbox has no DOM/browser access.
// Note: 'eval' and 'Function' are intentionally excluded — they cannot be used
// as parameter names in strict mode. In strict mode, direct eval() cannot
// introduce new variables into the outer scope, limiting its practical impact.
export const SANDBOX_BLOCKED = [
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

type SandboxedFn = (...args: unknown[]) => unknown

const SANDBOX_CACHE = new Map<string, SandboxedFn>()
const SANDBOX_CACHE_MAX = 256

export function createSandboxedFn(
  paramNames: string[],
  body: string,
  options: { strict?: boolean } = {}
): SandboxedFn {
  const strict = options.strict ?? true
  // Cache key must capture every input that affects fn identity. `paramNames`
  // order matters (positional args); strict mode affects semantics.
  const cacheKey = `${strict ? '1' : '0'}|${paramNames.join(',')}|${body}`
  const cached = SANDBOX_CACHE.get(cacheKey)
  if (cached) return cached

  const blocked = SANDBOX_BLOCKED.filter((name) => !paramNames.includes(name))
  const prelude = strict ? '"use strict";\n' : ''
  const fn = new Function(...blocked, ...paramNames, `${prelude}${body}`)
  const blockedUndefineds = blocked.map(() => undefined)
  const wrapped: SandboxedFn = (...values: unknown[]) => fn(...blockedUndefineds, ...values)

  if (SANDBOX_CACHE.size >= SANDBOX_CACHE_MAX) {
    // Cheap FIFO eviction — first key is oldest insertion.
    const oldest = SANDBOX_CACHE.keys().next().value
    if (oldest !== undefined) SANDBOX_CACHE.delete(oldest)
  }
  SANDBOX_CACHE.set(cacheKey, wrapped)
  return wrapped
}

/** Test-only: drop the compiled-fn cache. Not part of the public API. */
export function __clearSandboxCacheForTests(): void {
  SANDBOX_CACHE.clear()
}

export type Helpers = ReturnType<typeof buildHelpers>

export function buildHelpers() {
  return { ...casingHelpers }
}
