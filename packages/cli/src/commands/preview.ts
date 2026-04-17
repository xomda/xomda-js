import { readModel } from '@xomda/model/storage'
import { listTemplatesPP, renderTemplatePPByScope } from '@xomda/template'
import type { RenderResult } from '@xomda/template'

export async function preview(root: string): Promise<RenderResult[]> {
  const model = await readModel(root)
  const templates = await listTemplatesPP(root)

  const allResults: RenderResult[] = []
  for (const template of templates) {
    const results = await renderTemplatePPByScope(template, model)
    allResults.push(...results)
  }

  return allResults
}
