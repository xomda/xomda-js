import { addExtraLib } from '@xomda/codeeditor'

const STATIC_LIB_PATH = 'ts:filename/xomda-cell-context.d.ts'
const VARS_LIB_PATH = 'ts:filename/xomda-cell-vars.d.ts'

const SEALED_KEYS = new Set([
  'model',
  'console',
  '$out',
  '$ctx',
  'pascalCase',
  'camelCase',
  'snakeCase',
  'kebabCase',
  'constantCase',
  'upperCase',
  'lowerCase',
])

const STATIC_LIB = `
declare const model: unknown

interface XomdaCapturedConsole {
  log(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  info(...args: unknown[]): void
}
declare const console: XomdaCapturedConsole

interface XomdaOutputBuffer {
  write(chunk: string): void
  getContent(): string
}
declare const $out: XomdaOutputBuffer

declare const $ctx: Record<string, unknown>

declare function pascalCase(s: string): string
declare function camelCase(s: string): string
declare function snakeCase(s: string): string
declare function kebabCase(s: string): string
declare function constantCase(s: string): string
declare function upperCase(s: string): string
declare function lowerCase(s: string): string
`

let staticRegistered = false

export function registerCellContextStaticLib(): void {
  if (staticRegistered) return
  staticRegistered = true
  addExtraLib(STATIC_LIB, STATIC_LIB_PATH)
}

const VALID_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function buildVariablesLib(varNames: readonly (string | undefined)[]): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const name of varNames) {
    if (!name) continue
    if (SEALED_KEYS.has(name)) continue
    if (!VALID_IDENT.test(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    lines.push(`declare const ${name}: any`)
  }
  return lines.join('\n') + (lines.length ? '\n' : '')
}

export function setCellContextVariablesLib(varNames: readonly (string | undefined)[]): void {
  addExtraLib(buildVariablesLib(varNames), VARS_LIB_PATH)
}
