import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'
import { OutputBuffer } from './utils'

export const outputProcessor = defineProcessor({
  type: 'output',
  async execute(cell, ctx) {
    const { outputFilename, outputContent } = cell
    if (!outputFilename) return

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
    }

    const outputPath = resolveField(outputFilename, flatCtx)

    let content: string
    if (outputContent) {
      const rawContent = flatCtx[outputContent]
      content =
        rawContent instanceof OutputBuffer
          ? rawContent.getContent()
          : String(rawContent ?? '')
    } else {
      // Concatenate all preceding cell $out buffers in document order
      content = ctx.cellBuffers
        .slice(0, ctx.cellBuffers.length - 1)
        .map((buf) => buf.getContent())
        .join('')
    }

    ctx.files.push({ templateId: ctx.templateUuid, outputPath, content })
    ctx.$out.write(content)
  },
})
