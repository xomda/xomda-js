import { join } from 'node:path'

import { readModel } from '@xomda/model/storage'
import { listTemplates, renderTemplateByScope, writeRenderResults } from '@xomda/template'

export interface GenerateOptions {
  /** Directory (relative to root) to write generated files into. Defaults to root. */
  outputDir?: string
}

export async function generate(root: string, options: GenerateOptions = {}) {
  const model = await readModel(root)
  const templates = await listTemplates(root)

  const allResults = []
  for (const template of templates) {
    const results = await renderTemplateByScope(template, model)
    allResults.push(...results)
  }

  const writeRoot = options.outputDir ? join(root, options.outputDir) : root
  await writeRenderResults(allResults, writeRoot)
  return allResults
}
