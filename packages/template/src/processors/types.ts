import type { CellType, Template, TemplateCell } from '@xomda/core'

import type { RenderResult } from '../types'
import type { CapturedConsole, Helpers, OutputBuffer } from './utils'

export interface CellState {
  output: string
  contextDiff: Record<string, unknown>
  consoleLogs: string[]
  error: string | undefined
  done: boolean
}

export interface ExecutionContext {
  readonly model: unknown
  readonly scopeContext: Record<string, unknown>
  readonly helpers: Helpers
  readonly templateUuid: string
  variables: Record<string, unknown>
  readonly cellBuffers: OutputBuffer[]
  readonly files: RenderResult[]
}

export interface CellContext extends ExecutionContext {
  readonly $out: OutputBuffer
  readonly capturedConsole: CapturedConsole
  readonly state: CellState
}

export interface CellOutput {
  uuid: string
  output: string
  contextDiff?: Record<string, unknown>
  consoleLogs?: string[]
  error?: string
}

export interface CellProcessor<C extends TemplateCell = TemplateCell> {
  readonly type: CellType
  execute(cell: C, ctx: CellContext): void | Promise<void>
}

export interface CellInstance {
  readonly cell: TemplateCell
  readonly processor: CellProcessor
  readonly state: CellState
  execute(ctx: ExecutionContext): Promise<void>
  toCellOutput(): CellOutput
}

export interface TemplateExecutionResult {
  files: RenderResult[]
  cellOutputs: CellOutput[]
}

export type { CellType, Template, TemplateCell }
