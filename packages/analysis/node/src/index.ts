import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

import { detectPackageManager, type NodePackageMeta, parsePackageJson } from './package-parser'

async function loadNodeMeta(root: string): Promise<{ name: string; description?: string } | null> {
  try {
    const raw = await readFile(join(root, 'package.json'), 'utf-8')
    const parsed = JSON.parse(raw) as { name?: unknown; description?: unknown }
    const name = typeof parsed.name === 'string' && parsed.name.length > 0 ? parsed.name : null
    if (!name) return null
    const description =
      typeof parsed.description === 'string' && parsed.description.length > 0
        ? parsed.description
        : undefined
    return description ? { name, description } : { name }
  } catch {
    return null
  }
}

function identitySection(meta: NodePackageMeta): OverviewSection {
  const rows: Array<{ key: string; value: string }> = []
  if (meta.name) rows.push({ key: 'Name', value: meta.name })
  if (meta.version) rows.push({ key: 'Version', value: meta.version })
  if (meta.description) rows.push({ key: 'Description', value: meta.description })
  if (meta.license) rows.push({ key: 'License', value: meta.license })
  if (meta.type) rows.push({ key: 'Module type', value: meta.type })
  if (meta.main) rows.push({ key: 'Main', value: meta.main })
  if (meta.module) rows.push({ key: 'Module', value: meta.module })
  return { id: 'identity', kind: 'key-value', title: 'Package', rows }
}

function depsSection(
  id: string,
  title: string,
  deps: Record<string, string>
): OverviewSection | null {
  const entries = Object.entries(deps)
  if (entries.length === 0) return null
  return {
    id,
    kind: 'table',
    title,
    columns: ['Name', 'Version'],
    rows: entries.map(([name, version]) => [name, version]),
  }
}

function scriptsSection(meta: NodePackageMeta): OverviewSection | null {
  const entries = Object.entries(meta.scripts)
  if (entries.length === 0) return null
  return {
    id: 'scripts',
    kind: 'key-value',
    title: 'Scripts',
    rows: entries.map(([key, value]) => ({ key, value })),
  }
}

function workspacesSection(meta: NodePackageMeta): OverviewSection | null {
  if (meta.workspaces.length === 0) return null
  return {
    id: 'workspaces',
    kind: 'list',
    title: 'Workspaces',
    items: meta.workspaces.map((w) => ({ label: w })),
  }
}

async function packageManagerSection(
  meta: NodePackageMeta,
  ctx: AnalysisContext
): Promise<OverviewSection | null> {
  const pm = await detectPackageManager(meta, ctx.fileExists)
  if (!pm) return null
  return {
    id: 'package-manager',
    kind: 'status',
    title: 'Package manager',
    tone: 'info',
    label: pm.label,
    sub: pm.source === 'packageManager' ? 'From package.json' : `Detected via ${pm.source}`,
  }
}

function enginesSection(meta: NodePackageMeta): OverviewSection | null {
  const entries = Object.entries(meta.engines)
  if (entries.length === 0) return null
  return {
    id: 'engines',
    kind: 'key-value',
    title: 'Engines',
    rows: entries.map(([key, value]) => ({ key, value })),
  }
}

async function loadNodeOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const raw = await ctx.readFile('package.json')
  if (!raw) return null
  const meta = parsePackageJson(raw)
  if (!meta) return null

  const sections: OverviewSection[] = [identitySection(meta)]
  const pm = await packageManagerSection(meta, ctx)
  if (pm) sections.push(pm)
  const eng = enginesSection(meta)
  if (eng) sections.push(eng)
  const ws = workspacesSection(meta)
  if (ws) sections.push(ws)
  const scripts = scriptsSection(meta)
  if (scripts) sections.push(scripts)
  const deps = depsSection('deps', 'Dependencies', meta.dependencies)
  if (deps) sections.push(deps)
  const devDeps = depsSection('dev-deps', 'Dev dependencies', meta.devDependencies)
  if (devDeps) sections.push(devDeps)
  const peerDeps = depsSection('peer-deps', 'Peer dependencies', meta.peerDependencies)
  if (peerDeps) sections.push(peerDeps)
  const optDeps = depsSection('opt-deps', 'Optional dependencies', meta.optionalDependencies)
  if (optDeps) sections.push(optDeps)

  return {
    pluginId: 'node',
    pluginName: 'Node.js',
    icon: 'node',
    sections,
  }
}

export const nodePlugin: AnalysisPlugin = {
  id: 'node',
  name: 'Node.js',
  icon: 'node',
  patterns: [{ type: 'file-exists', paths: ['package.json'] }],
  fileTypes: [
    {
      id: 'package-json',
      label: 'Node package manifest',
      match: { filenames: ['package.json'] },
      icon: 'node',
      views: [
        { id: 'source', label: 'Source', preview: { kind: 'text', language: 'json' } },
        {
          id: 'info',
          label: 'Info',
          preview: { kind: 'custom', componentId: 'node-package-info' },
          loadViewData: async (ctx, relativePath) => {
            const raw = await ctx.readFile(relativePath)
            if (!raw) return null
            return parsePackageJson(raw)
          },
        },
      ],
      priority: 30,
    },
    {
      id: 'pnpm-workspace',
      label: 'pnpm workspace',
      match: { filenames: ['pnpm-workspace.yaml'] },
      icon: 'node',
      preview: { kind: 'text', language: 'yaml' },
      priority: 20,
    },
  ],
  projectKind: {
    marker: 'package.json',
    loadMeta: loadNodeMeta,
  },
  loadOverview: loadNodeOverview,
}

registerAnalysisPlugin(nodePlugin)
