import { render } from '../handlebarsEngine'
import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'

export const handlebarsProcessor = defineProcessor({
  type: 'handlebars',
  execute(cell, ctx) {
    if (!cell.content.trim()) return

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
    }

    const rendered = render(cell.content, flatCtx)
    ctx.$out.write(rendered)

    const varName = resolveField(cell.variableName, flatCtx)
    if (varName) {
      ctx.state.contextDiff[varName] = rendered
    }
  },
})
