import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'

import matter from 'gray-matter'

import { getTemplatesDir } from './constants'
import { HandlebarsTemplateFolderSchema, HandlebarsTemplateSchema } from './handlebarsSchema'
import type { HandlebarsTemplate, HandlebarsTemplateFolder } from './types'

export { HandlebarsTemplateSchema, HandlebarsTemplateFolderSchema }

function parseTemplate(id: string, raw: string, path?: string): HandlebarsTemplate {
  const { data, content } = matter(raw)
  return {
    id,
    path,
    name: data.name ?? id,
    description: data.description,
    outputPath: data.outputPath ?? id,
    language: data.language,
    scope: data.scope,
    disabled: data.disabled,
    content: content.trim(),
  }
}

function serialiseTemplate(template: HandlebarsTemplate): string {
  const frontmatter = {
    name: template.name,
    outputPath: template.outputPath,
    ...(template.language ? { language: template.language } : {}),
    ...(template.scope ? { scope: template.scope } : {}),
    ...(template.description ? { description: template.description } : {}),
    ...(template.disabled !== undefined ? { disabled: template.disabled } : {}),
  }
  return matter.stringify(template.content, frontmatter)
}

export async function listHandlebarsTemplates(
  root = process.cwd()
): Promise<HandlebarsTemplate[]> {
  const dir = getTemplatesDir(root)
  if (!existsSync(dir)) return []
  const results: HandlebarsTemplate[] = []
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.isFile() && extname(entry.name) === '.hbs') {
        const relativeFilePath = relative(dir, fullPath)
        const id = relativeFilePath.replace(/\.hbs$/, '')
        const raw = await readFile(fullPath, 'utf-8')
        results.push(parseTemplate(id, raw, id))
      }
    }
  }
  await scan(dir)
  return results
}

export async function readHandlebarsTemplate(
  id: string,
  root = process.cwd()
): Promise<HandlebarsTemplate> {
  const path = join(getTemplatesDir(root), `${id}.hbs`)
  if (!existsSync(path)) throw new Error(`HandlebarsTemplate "${id}" not found`)
  const raw = await readFile(path, 'utf-8')
  return parseTemplate(id, raw, id)
}

export async function writeHandlebarsTemplate(
  template: HandlebarsTemplate,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const fullPath = join(dir, `${template.id}.hbs`)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, serialiseTemplate(template), 'utf-8')
}

export async function moveHandlebarsTemplate(
  oldPath: string,
  newPath: string,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const oldFullPath = join(dir, `${oldPath}.hbs`)
  const newFullPath = join(dir, `${newPath}.hbs`)
  if (!existsSync(oldFullPath)) throw new Error(`HandlebarsTemplate "${oldPath}" not found`)
  await mkdir(dirname(newFullPath), { recursive: true })
  const content = await readFile(oldFullPath)
  await writeFile(newFullPath, content)
  await unlink(oldFullPath)
}

export async function moveHandlebarsTemplateFolder(
  oldPath: string,
  newPath: string,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const oldFullPath = join(dir, oldPath)
  const newFullPath = join(dir, newPath)
  if (!existsSync(oldFullPath)) throw new Error(`Folder "${oldPath}" not found`)
  await mkdir(dirname(newFullPath), { recursive: true })
  await rename(oldFullPath, newFullPath)
}

export async function deleteHandlebarsTemplate(id: string, root = process.cwd()): Promise<void> {
  const path = join(getTemplatesDir(root), `${id}.hbs`)
  if (existsSync(path)) await unlink(path)
}

export async function listHandlebarsTemplateFolders(
  root = process.cwd()
): Promise<HandlebarsTemplateFolder[]> {
  const dir = getTemplatesDir(root)
  if (!existsSync(dir)) return []
  const results: HandlebarsTemplateFolder[] = []
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(currentDir, entry.name)
        const relPath = relative(dir, fullPath)
        let folderMeta: Partial<HandlebarsTemplateFolder> = {}
        const metaPath = join(fullPath, '.folder.json')
        if (existsSync(metaPath)) {
          try {
            folderMeta = JSON.parse(await readFile(metaPath, 'utf-8'))
          } catch (e) {
            console.error(`Failed to parse folder metadata at ${metaPath}`, e)
          }
        }
        results.push({
          path: relPath,
          name: folderMeta.name ?? entry.name,
          description: folderMeta.description,
          tags: folderMeta.tags,
        })
        await scan(fullPath)
      }
    }
  }
  await scan(dir)
  return results
}

export async function saveHandlebarsTemplateFolder(
  folder: HandlebarsTemplateFolder,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const fullPath = join(dir, folder.path)
  await mkdir(fullPath, { recursive: true })
  const metaPath = join(fullPath, '.folder.json')
  const meta = { name: folder.name, description: folder.description, tags: folder.tags }
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}
