import { defineProcessor } from './defineProcessor'
import { resolveField } from './resolveField'
import { OutputBuffer } from './utils'

export const outputProcessor = defineProcessor({
  type: 'output',
  async execute(cell, ctx) {
    const { outputFilename, outputDirectory, outputContent } = cell
    if (!outputFilename) return

    const flatCtx: Record<string, unknown> = {
      model: ctx.model,
      ...ctx.scopeContext,
      ...ctx.variables,
      ...ctx.helpers,
    }

    const filename = resolveField(outputFilename, flatCtx)
    const directory = resolveField(outputDirectory, flatCtx)

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

    const outputPath = directory
      ? `${directory.replace(/\/$/, '')}/${filename}`
      : filename

    ctx.files.push({ templateId: ctx.templateUuid, outputPath, content })
    ctx.$out.write(content)
  },
})
