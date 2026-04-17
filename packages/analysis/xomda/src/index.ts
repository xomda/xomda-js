import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'

import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'
import { DEFAULT_PROJECT_SCAN_EXCLUDES, ProjectFileSchema, XOMDA_DIR } from '@xomda/core'

const MAX_SUBPROJECT_DEPTH = 4

interface XomdaProjectMeta {
  name: string
  description?: string
  isRoot: boolean
  excludeFromScan: string[]
}

async function readXomdaProjectMetaRaw(root: string): Promise<XomdaProjectMeta | null> {
  const projectJson = join(root, XOMDA_DIR, 'project.json')
  if (existsSync(projectJson)) {
    try {
      const raw = await readFile(projectJson, 'utf-8')
      const parsed = ProjectFileSchema.parse(JSON.parse(raw))
      return {
        name: parsed.name,
        description: parsed.description,
        isRoot: parsed.settings.isRoot,
        excludeFromScan: parsed.settings.excludeFromScan,
      }
    } catch {
      // fall through to folder-basename fallback
    }
  }
  if (!existsSync(join(root, XOMDA_DIR))) return null
  return {
    name: basename(root) || 'project',
    isRoot: false,
    excludeFromScan: [...DEFAULT_PROJECT_SCAN_EXCLUDES],
  }
}

interface SubprojectFinder {
  /** Folder names always skipped during the walk. */
  excludes: Set<string>
  /** Project-relative paths always skipped (matched against `relative(root, child)`). */
  excludePaths: Set<string>
}

function makeFinder(excludeFromScan: readonly string[]): SubprojectFinder {
  const excludes = new Set<string>()
  const excludePaths = new Set<string>()
  for (const entry of excludeFromScan) {
    if (entry.includes('/') || entry.includes('\\')) {
      // path-like → match the full project-relative path
      excludePaths.add(entry.replace(/\\/g, '/').replace(/^\.\//, ''))
    } else {
      excludes.add(entry)
    }
  }
  return { excludes, excludePaths }
}

function walkForSubprojects(
  root: string,
  current: string,
  depth: number,
  finder: SubprojectFinder,
  found: Array<{ path: string; name: string; isRoot: boolean }>
): void {
  if (depth > MAX_SUBPROJECT_DEPTH) return
  let entries: string[]
  try {
    entries = readdirSync(current)
  } catch {
    return
  }
  for (const entry of entries) {
    if (finder.excludes.has(entry)) continue
    const child = join(current, entry)
    const rel = relative(root, child).replace(/\\/g, '/')
    if (finder.excludePaths.has(rel)) continue
    let isDir: boolean
    try {
      isDir = statSync(child).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue

    if (existsSync(join(child, XOMDA_DIR))) {
      // Read this subproject's settings to know whether it claims to
      // own its subtree (isRoot=true) — if so, list it but don't
      // recurse past it. Tolerate parse errors quietly.
      let subIsRoot = false
      try {
        const projectJson = join(child, XOMDA_DIR, 'project.json')
        if (existsSync(projectJson)) {
          const raw = readFileSync(projectJson, 'utf-8')
          const parsed = ProjectFileSchema.parse(JSON.parse(raw))
          subIsRoot = parsed.settings.isRoot
        }
      } catch {
        // swallow — fall through with subIsRoot=false
      }
      found.push({ path: rel, name: basename(child), isRoot: subIsRoot })
      if (subIsRoot) continue // don't recurse into another root's subtree
    }
    walkForSubprojects(root, child, depth + 1, finder, found)
  }
}

function countTemplates(root: string): number {
  const templatesDir = join(root, XOMDA_DIR, 'templates')
  if (!existsSync(templatesDir)) return 0
  let count = 0
  const stack = [templatesDir]
  while (stack.length > 0) {
    const cur = stack.pop()!
    let names: string[]
    try {
      names = readdirSync(cur)
    } catch {
      continue
    }
    for (const n of names) {
      const child = join(cur, n)
      try {
        const s = statSync(child)
        if (s.isDirectory()) stack.push(child)
        else if (n.endsWith('.template.json')) count++
      } catch {
        // skip
      }
    }
  }
  return count
}

interface ModelCounts {
  packages: number
  entities: number
  enums: number
}

/**
 * Best-effort counts pulled from `.xomda/model.json` without depending
 * on the full @xomda/template/model schema. The model.json contract is
 * stable across versions for these top-level array lengths, so a quick
 * shallow read is sufficient for the homepage summary. Returns zeros
 * silently when the file is missing or malformed.
 */
function countModelEntries(root: string): ModelCounts {
  const path = join(root, XOMDA_DIR, 'model.json')
  if (!existsSync(path)) return { packages: 0, entities: 0, enums: 0 }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as {
      packages?: unknown[]
      entities?: unknown[]
      enums?: unknown[]
    }
    return {
      packages: Array.isArray(parsed.packages) ? parsed.packages.length : 0,
      entities: Array.isArray(parsed.entities) ? parsed.entities.length : 0,
      enums: Array.isArray(parsed.enums) ? parsed.enums.length : 0,
    }
  } catch {
    return { packages: 0, entities: 0, enums: 0 }
  }
}

async function loadXomdaOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const meta = await readXomdaProjectMetaRaw(ctx.rootPath)
  if (!meta) return null
  const counts = countModelEntries(ctx.rootPath)
  const templateCount = countTemplates(ctx.rootPath)
  const sections: OverviewSection[] = []

  const identityRows: Array<{ key: string; value: string }> = [{ key: 'Name', value: meta.name }]
  if (meta.description) identityRows.push({ key: 'Description', value: meta.description })
  identityRows.push({ key: 'Workspace boundary', value: meta.isRoot ? 'yes' : 'no' })
  sections.push({ id: 'identity', kind: 'key-value', title: 'xomda project', rows: identityRows })

  if (counts.entities || counts.enums || counts.packages) {
    sections.push({
      id: 'model',
      kind: 'key-value',
      title: 'Model',
      rows: [
        { key: 'Entities', value: String(counts.entities) },
        { key: 'Enums', value: String(counts.enums) },
        { key: 'Packages', value: String(counts.packages) },
      ],
    })
  }

  sections.push({
    id: 'templates',
    kind: 'status',
    title: 'Templates',
    tone: templateCount > 0 ? 'success' : 'info',
    label: `${templateCount} template${templateCount === 1 ? '' : 's'} in .xomda/templates`,
  })

  return {
    pluginId: 'xomda',
    pluginName: 'xomda Project',
    icon: 'xomda',
    sections,
  }
}

export const xomdaPlugin: AnalysisPlugin = {
  id: 'xomda',
  name: 'xomda Project',
  icon: 'xomda',
  patterns: [{ type: 'file-exists', paths: [XOMDA_DIR] }],
  fileTypes: [
    {
      id: 'xomda-model',
      label: 'xomda model',
      match: { filenames: ['model.json'] },
      icon: 'xomda',
      preview: { kind: 'custom', componentId: 'xomda-model-view' },
      priority: 100,
    },
    {
      id: 'xomda-project',
      label: 'xomda project',
      match: { filenames: ['project.json'] },
      icon: 'xomda',
      preview: { kind: 'text', language: 'json' },
      priority: 50,
    },
    {
      id: 'xomda-template',
      label: 'xomda template',
      match: { pathGlobs: ['**/*.template.json'] },
      icon: 'xomda',
      preview: { kind: 'custom', componentId: 'xomda-template-view' },
      priority: 100,
    },
  ],
  projectKind: {
    marker: XOMDA_DIR,
    loadMeta: async (root) => {
      const meta = await readXomdaProjectMetaRaw(root)
      return meta && { name: meta.name, description: meta.description }
    },
    hooks: {
      listSubprojects: async (root) => {
        const meta = await readXomdaProjectMetaRaw(root)
        const excludes = meta?.excludeFromScan ?? [...DEFAULT_PROJECT_SCAN_EXCLUDES]
        const finder = makeFinder(excludes)
        const found: Array<{ path: string; name: string; isRoot: boolean }> = []
        walkForSubprojects(root, root, 0, finder, found)
        return found
      },
    },
  },
  loadOverview: loadXomdaOverview,
}

registerAnalysisPlugin(xomdaPlugin)
