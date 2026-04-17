import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

import type { Template, TemplateFolder } from '@xomda/core'
import { normalizeTemplate, TemplateFolderSchema, TemplateSchema } from '@xomda/core'
import { createLogger } from '@xomda/util'

import { getTemplatesDir } from './constants'

const EXTENSION = '.template.json'
const log = createLogger('template.storage')

export async function listTemplates(root = process.cwd()): Promise<Template[]> {
  const dir = getTemplatesDir(root)
  if (!existsSync(dir)) return []

  const results: Template[] = []

  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await scan(fullPath)
      } else if (entry.isFile() && entry.name.endsWith(EXTENSION)) {
        try {
          const raw = await readFile(fullPath, 'utf-8')
          const parsed = TemplateSchema.parse(normalizeTemplate(JSON.parse(raw)))
          results.push(parsed)
        } catch (e) {
          log.error(`Failed to parse template at ${fullPath}`, { data: e })
        }
      }
    }
  }

  await scan(dir)
  return results
}

export async function readTemplate(uuid: string, root = process.cwd()): Promise<Template> {
  const all = await listTemplates(root)
  const found = all.find((t) => t.uuid === uuid)
  if (!found) throw new Error(`Template "${uuid}" not found`)
  return found
}

export async function writeTemplate(template: Template, root = process.cwd()): Promise<void> {
  const dir = getTemplatesDir(root)
  const existing = await findFilePath(template.uuid, dir)
  const filePath = existing ?? join(dir, sanitizeFilename(template.name) + EXTENSION)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(template, null, 2), 'utf-8')
}

export async function deleteTemplate(uuid: string, root = process.cwd()): Promise<void> {
  const dir = getTemplatesDir(root)
  const filePath = await findFilePath(uuid, dir)
  if (filePath && existsSync(filePath)) await unlink(filePath)
}

async function findFilePath(uuid: string, dir: string): Promise<string | null> {
  if (!existsSync(dir)) return null

  async function scan(currentDir: string): Promise<string | null> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        const found = await scan(fullPath)
        if (found) return found
      } else if (entry.isFile() && entry.name.endsWith(EXTENSION)) {
        try {
          const raw = await readFile(fullPath, 'utf-8')
          const data = JSON.parse(raw)
          if (data.uuid === uuid) return fullPath
        } catch (e) {
          // One corrupt file shouldn't kill the scan — log and keep walking.
          log.warn(`Skipping unparseable template during findFilePath at ${fullPath}`, { data: e })
        }
      }
    }
    return null
  }

  return scan(dir)
}

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'template'
  )
}

export async function listTemplateFolders(root = process.cwd()): Promise<TemplateFolder[]> {
  const dir = getTemplatesDir(root)
  if (!existsSync(dir)) return []
  const results: TemplateFolder[] = []
  async function scan(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(currentDir, entry.name)
        const relPath = relative(dir, fullPath)
        let folderMeta: Partial<TemplateFolder> = {}
        const metaPath = join(fullPath, '.folder.json')
        if (existsSync(metaPath)) {
          try {
            folderMeta = TemplateFolderSchema.partial().parse(
              JSON.parse(await readFile(metaPath, 'utf-8'))
            )
          } catch (e) {
            log.error(`Failed to parse folder metadata at ${metaPath}`, { data: e })
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

export async function saveTemplateFolder(
  folder: TemplateFolder,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const fullPath = join(dir, folder.path)
  await mkdir(fullPath, { recursive: true })
  const metaPath = join(fullPath, '.folder.json')
  const meta = { name: folder.name, description: folder.description, tags: folder.tags }
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

export async function moveTemplate(
  uuid: string,
  toFolder: string,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const oldPath = await findFilePath(uuid, dir)
  if (!oldPath) throw new Error(`Template "${uuid}" not found`)
  const raw = await readFile(oldPath, 'utf-8')
  const template: Template = { ...JSON.parse(raw), folder: toFolder || undefined }
  const targetDir = toFolder ? join(dir, toFolder) : dir
  await mkdir(targetDir, { recursive: true })
  const newPath = join(targetDir, basename(oldPath))
  await writeFile(newPath, JSON.stringify(template, null, 2), 'utf-8')
  if (oldPath !== newPath) await unlink(oldPath)
}

export async function deleteTemplateFolder(path: string, root = process.cwd()): Promise<void> {
  if (!path || path === '.' || isAbsolute(path)) {
    throw new Error(`Invalid folder path: "${path}"`)
  }
  const dir = getTemplatesDir(root)
  const fullPath = resolve(dir, path)
  const rel = relative(dir, fullPath)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Folder path escapes templates directory: "${path}"`)
  }
  if (!existsSync(fullPath)) return
  await rm(fullPath, { recursive: true, force: true })
}

export async function moveTemplateFolder(
  fromPath: string,
  toPath: string,
  root = process.cwd()
): Promise<void> {
  const dir = getTemplatesDir(root)
  const oldFullPath = join(dir, fromPath)
  const newFullPath = join(dir, toPath)
  if (!existsSync(oldFullPath)) throw new Error(`Folder "${fromPath}" not found`)
  await mkdir(dirname(newFullPath), { recursive: true })
  await rename(oldFullPath, newFullPath)
}
