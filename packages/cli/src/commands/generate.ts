import { readModel } from '@xomda/model/storage'
import { listTemplatesPP, renderTemplatePPByScope, writeRenderResults } from '@xomda/template'

export async function generate(root: string) {
  const model = await readModel(root)
  const templates = await listTemplatesPP(root)

  const allResults = []
  for (const template of templates) {
    const results = await renderTemplatePPByScope(template, model)
    allResults.push(...results)
  }

  await writeRenderResults(allResults, root)
  return allResults
}
