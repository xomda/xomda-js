import { readModel } from '@xomda/model/storage'
import type { RenderResult } from '@xomda/template'
import { listTemplates, renderTemplateByScope } from '@xomda/template'

export async function preview(root: string): Promise<RenderResult[]> {
  const model = await readModel(root)
  const templates = await listTemplates(root)

  const allResults: RenderResult[] = []
  for (const template of templates) {
    const results = await renderTemplateByScope(template, model)
    allResults.push(...results)
  }

  return allResults
}
