import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { readModel } from '@xomda/model/storage'
import { listTemplatesPP, renderTemplatePPByScope } from '@xomda/template'
import type { RenderResult } from '@xomda/template'

export interface DiffEntry {
  outputPath: string
  generated: string
  current: string | null
  changed: boolean
}

export async function diff(root: string): Promise<DiffEntry[]> {
  const model = await readModel(root)
  const templates = await listTemplatesPP(root)

  const allResults: RenderResult[] = []
  for (const template of templates) {
    allResults.push(...(await renderTemplatePPByScope(template, model)))
  }

  return Promise.all(
    allResults.map(async (result) => {
      const fullPath = join(root, result.outputPath)
      const current = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : null
      return {
        outputPath: result.outputPath,
        generated: result.content,
        current,
        changed: current !== result.content,
      }
    })
  )
}
