import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'

export const outputProcessor = defineProcessor({
  type: 'output',
  async execute(cell, ctx) {
    const { outputType = 'file', outputFilename, outputContent } = cell

    // Sum all previously-pushed buffers in this scope (everything except this
    // cell's own $out, which is the last entry).
    const prior = ctx.cellBuffers.slice(0, ctx.cellBuffers.length - 1)
    const content = prior.map((buf) => buf.getContent()).join('')

    if (outputType === 'context') {
      // Context output is a non-consuming snapshot: the same upstream content
      // remains available to subsequent cells. Don't clear cellBuffers.
      if (!outputContent) return
      ctx.variables[outputContent] = content
      return
    }

    // File output consumes the prior buffers so the surrounding scope
    // (especially a loop's aggregate) doesn't re-emit the same content —
    // this is what enables "output inside the loop = file per iteration,
    // output after the loop = file with the total".
    ctx.cellBuffers.splice(0, prior.length)

    if (!outputFilename) return

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
    }

    const outputPath = resolveField(outputFilename, flatCtx)

    ctx.files.push({ templateId: ctx.templateUuid, outputPath, content })
    ctx.$out.write(content)
  },
})
