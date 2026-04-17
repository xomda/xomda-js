import { readModel } from '@xomda/model/storage'
import { listTemplates, renderTemplateByScope, writeRenderResults } from '@xomda/template'

export async function generate(root: string) {
  const model = await readModel(root)
  const templates = await listTemplates(root)

  const allResults = []
  for (const template of templates) {
    const results = await renderTemplateByScope(template, model)
    allResults.push(...results)
  }

  await writeRenderResults(allResults, root)
  return allResults
}
