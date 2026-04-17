import { camelCase, constantCase, kebabCase, pascalCase, snakeCase } from 'change-case'

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

export function createSandboxedFn(paramNames: string[], body: string): (...args: unknown[]) => unknown {
  const blocked = SANDBOX_BLOCKED.filter((name) => !paramNames.includes(name))
  const fn = new Function(...blocked, ...paramNames, `"use strict";\n${body}`)
  const blockedUndefineds = blocked.map(() => undefined)
  return (...values: unknown[]) => fn(...blockedUndefineds, ...values)
}

export type Helpers = ReturnType<typeof buildHelpers>

export function buildHelpers() {
  return {
    pascalCase: (s: string) => pascalCase(s ?? ''),
    camelCase: (s: string) => camelCase(s ?? ''),
    snakeCase: (s: string) => snakeCase(s ?? ''),
    kebabCase: (s: string) => kebabCase(s ?? ''),
    constantCase: (s: string) => constantCase(s ?? ''),
    upperCase: (s: string) => (s ?? '').toUpperCase(),
    lowerCase: (s: string) => (s ?? '').toLowerCase(),
  }
}
