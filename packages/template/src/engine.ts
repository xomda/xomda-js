import type { Model, ModelDiff, Template } from '@xomda/core'

import { createCellInstance, createExecutionContext } from './processors/registry'
import type { CellOutput, TemplateExecutionResult } from './processors/types'

export { OutputBuffer } from './processors/utils'
export type { CellOutput, TemplateExecutionResult }

export async function executeTemplate(
  template: Template,
  model: Model,
  scopeContext: Record<string, unknown> = {},
  diff?: ModelDiff
): Promise<TemplateExecutionResult> {
  const execCtx = createExecutionContext(template, model, scopeContext, diff)
  const instances = template.cells.map(createCellInstance)

  for (const instance of instances) {
    await instance.execute(execCtx)
  }

  return {
    files: execCtx.files,
    cellOutputs: instances.map((inst) => inst.toCellOutput()),
  }
}
