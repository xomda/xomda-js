import type { CellType, Model, ModelDiff, Template, TemplateCell } from '@xomda/core'

import type { RenderResult } from '../types'
import { bufferProcessor } from './buffer'
import { handlebarsProcessor } from './handlebars'
import { logicProcessor } from './logic'
import { markdownProcessor } from './markdown'
import { outputProcessor } from './output'
import { providerProcessor } from './provider'
import type {
  CellContext,
  CellInstance,
  CellOutput,
  CellProcessor,
  CellState,
  ExecutionContext,
} from './types'
import { buildHelpers, CapturedConsole, OutputBuffer } from './utils'

export const PROCESSORS: Record<CellType, CellProcessor> = {
  logic: logicProcessor,
  buffer: bufferProcessor,
  handlebars: handlebarsProcessor,
  output: outputProcessor,
  markdown: markdownProcessor,
  provider: providerProcessor,
  'provider-logic': providerProcessor,
}

export function createCellInstance(cell: TemplateCell): CellInstance {
  const processor = PROCESSORS[cell.type]
  const state: CellState = {
    output: '',
    contextDiff: {},
    consoleLogs: [],
    error: undefined,
    done: false,
  }

  return {
    cell,
    processor,
    state,

    async execute(execCtx: ExecutionContext): Promise<void> {
      const $out = new OutputBuffer()
      execCtx.cellBuffers.push($out)
      const capturedConsole = new CapturedConsole()

      const cellCtx: CellContext = {
        ...execCtx,
        $out,
        capturedConsole,
        state,
      }

      try {
        await processor.execute(cell, cellCtx)
      } catch (err) {
        state.error = err instanceof Error ? err.message : String(err)
      }

      state.output = $out.getContent()
      state.consoleLogs = [...capturedConsole.logs]
      state.done = true

      Object.assign(execCtx.variables, state.contextDiff)
    },

    toCellOutput(): CellOutput {
      return {
        uuid: cell.uuid,
        output: state.output,
        contextDiff: Object.keys(state.contextDiff).length > 0 ? state.contextDiff : undefined,
        consoleLogs: state.consoleLogs.length > 0 ? state.consoleLogs : undefined,
        error: state.error,
      }
    },
  }
}

export function createExecutionContext(
  template: Template,
  model: Model,
  scopeContext: Record<string, unknown> = {},
  diff?: ModelDiff
): ExecutionContext & { files: RenderResult[] } {
  return {
    model,
    scopeContext,
    helpers: buildHelpers(),
    templateUuid: template.uuid,
    diff,
    variables: {},
    cellBuffers: [],
    files: [],
  }
}
