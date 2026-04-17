import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { normalizeTemplate, type Template, TEMPLATES_DIR, TemplateSchema, XOMDA_DIR } from '@xomda/core'

const EXTENSION = '.template.json'

export interface TemplateWithPath {
  template: Template
  path: string
}

export async function listTemplatesWithPaths(root: string): Promise<TemplateWithPath[]> {
  const dir = join(root, XOMDA_DIR, TEMPLATES_DIR)
  if (!existsSync(dir)) return []
  const out: TemplateWithPath[] = []
  await scan(dir, out)
  return out
}

async function scan(currentDir: string, out: TemplateWithPath[]): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await scan(fullPath, out)
    } else if (entry.isFile() && entry.name.endsWith(EXTENSION)) {
      const raw = await readFile(fullPath, 'utf-8')
      const template = TemplateSchema.parse(normalizeTemplate(JSON.parse(raw)))
      out.push({ template, path: fullPath })
    }
  }
}
