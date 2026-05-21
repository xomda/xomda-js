import type { CellType, Model, ModelDiff, Template, TemplateCell } from '@xomda/core'

import type { RenderResult } from '../types'
import type { CapturedConsole, Helpers, OutputBuffer } from './utils'

/**
 * Workspace-lens descriptor for a project surfaced through the `projects`
 * loop source. `root` is the absolute path of the project, `models` are
 * its full Models (so a nested `models` loop can iterate them).
 */
export interface ProjectInfo {
  root: string
  name: string
  isRoot: boolean
  models: Model[]
}

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
  readonly diff: ModelDiff | undefined
  variables: Record<string, unknown>
  readonly cellBuffers: OutputBuffer[]
  readonly files: RenderResult[]
  // The "collection object" passed as the first argument to a nested loop's
  // JS-generator function. At top level this is `undefined` (the collector
  // falls back to `model`); inside a loop's children it is the parent's
  // current item.
  readonly currentItem?: unknown
  // The parent loop's current iteration index. `0` at top level.
  readonly parentIndex?: number
  /**
   * Every model in the active project. Resolved by the renderer; defaults
   * to `[execCtx.model]` when the caller doesn't supply one. Drives the
   * `models` loop source.
   */
  readonly allModels?: Model[]
  /**
   * Every project visible to this render. Defaults to a singleton wrapping
   * the active project when the caller doesn't supply one. Drives the
   * `projects` loop source — a project's `.models` field carries every
   * model in that project so authors can nest a `models` loop inside.
   */
  readonly allProjects?: ProjectInfo[]
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
