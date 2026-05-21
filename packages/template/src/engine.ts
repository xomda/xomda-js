import type { Model, ModelDiff, Template, TemplateCell } from '@xomda/core'

import { collectLoopItems } from './processors/loop'
import { createCellInstance, createExecutionContext } from './processors/registry'
import type {
  CellOutput,
  ExecutionContext,
  ProjectInfo,
  TemplateExecutionResult,
} from './processors/types'
import { OutputBuffer } from './processors/utils'

export { OutputBuffer } from './processors/utils'
export type { CellOutput, TemplateExecutionResult }

function isLoop(cell: TemplateCell): boolean {
  return cell.type === 'loop' || cell.type === 'loop-logic'
}

async function executeCells(
  cells: TemplateCell[],
  execCtx: ExecutionContext
): Promise<CellOutput[]> {
  const outputs: CellOutput[] = []

  for (const cell of cells) {
    if (!isLoop(cell)) {
      const instance = createCellInstance(cell)
      await instance.execute(execCtx)
      // Output cells have already consumed prior buffers and written the
      // file. Drop their own $out so the surrounding scope (e.g. a loop's
      // aggregate) doesn't re-emit the file contents.
      if (cell.type === 'output') {
        execCtx.cellBuffers.pop()
      }
      outputs.push(instance.toCellOutput())
      continue
    }

    // Loop cell: iterate over collected items, recurse into children per item.
    const aggregateBuf = new OutputBuffer()
    execCtx.cellBuffers.push(aggregateBuf)

    const varName = cell.variableName ?? 'item'
    const source = cell.type === 'loop-logic' ? 'javascript' : cell.loopSource
    let loopError: string | undefined
    const iterationOutputs: CellOutput[] = []
    let iterationCount = 0
    try {
      const items = await collectLoopItems({
        source,
        content: cell.content,
        model: execCtx.model as Model,
        diff: execCtx.diff,
        scopeVariables: execCtx.variables,
        collectionObject: execCtx.currentItem,
        parentIndex: execCtx.parentIndex,
        ctx: execCtx.scopeContext,
        filter: cell.loopFilter,
        ...(execCtx.allModels !== undefined ? { allModels: execCtx.allModels } : {}),
        ...(execCtx.allProjects !== undefined ? { allProjects: execCtx.allProjects } : {}),
      })
      for (const [idx, item] of items.entries()) {
        iterationCount++
        const itemVars: Record<string, unknown> = {
          [varName]: item,
          ...(item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : {}),
        }
        // Workspace-scope swap: inside a `models` loop, the iterated item
        // becomes the model `execCtx.model` for child cells, so a nested
        // `entities`/`enums`/`packages` loop resolves against that model
        // instead of the outer one. `projects` does NOT swap — a project
        // has multiple models, so authors nest a `models` loop inside.
        const iteratedModel: unknown =
          source === 'models' && item !== null && typeof item === 'object' ? item : execCtx.model
        const iterCtx: ExecutionContext = {
          model: iteratedModel,
          scopeContext: execCtx.scopeContext,
          helpers: execCtx.helpers,
          templateUuid: execCtx.templateUuid,
          diff: execCtx.diff,
          variables: { ...execCtx.variables, ...itemVars },
          cellBuffers: [],
          files: execCtx.files,
          currentItem: item,
          parentIndex: idx,
          ...(execCtx.allModels !== undefined ? { allModels: execCtx.allModels } : {}),
          ...(execCtx.allProjects !== undefined ? { allProjects: execCtx.allProjects } : {}),
        }
        const childOutputs = await executeCells(cell.children ?? [], iterCtx)
        iterationOutputs.push(...childOutputs)
        // Any content not consumed by an inner output cell bubbles up.
        for (const b of iterCtx.cellBuffers) aggregateBuf.write(b.getContent())
      }
    } catch (err) {
      loopError = err instanceof Error ? err.message : String(err)
    }

    outputs.push({
      uuid: cell.uuid,
      output: aggregateBuf.getContent(),
      contextDiff: { __iterations: iterationCount },
      error: loopError,
    })
    outputs.push(...iterationOutputs)
  }

  return outputs
}

export async function executeTemplate(
  template: Template,
  model: Model,
  scopeContext: Record<string, unknown> = {},
  diff?: ModelDiff,
  workspace?: { allModels?: Model[]; allProjects?: ProjectInfo[] }
): Promise<TemplateExecutionResult> {
  const execCtx = createExecutionContext(template, model, scopeContext, diff, workspace)
  const cellOutputs = await executeCells(template.cells, execCtx)
  return {
    files: execCtx.files,
    cellOutputs,
  }
}
