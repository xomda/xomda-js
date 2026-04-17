import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'
import { OutputBuffer } from './utils'

export const bufferProcessor = defineProcessor({
  type: 'buffer',
  execute(cell, ctx) {
    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
    }
    const varName = resolveField(cell.variableName, flatCtx)
    if (varName) {
      const buf = new OutputBuffer()
      ctx.state.contextDiff[varName] = buf
    }
  },
})
