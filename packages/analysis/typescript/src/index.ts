import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  type PluginMatch,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

interface TsConfig {
  compilerOptions?: {
    rootDir?: string
    baseUrl?: string
    target?: string
    module?: string
    moduleResolution?: string
    strict?: boolean
    jsx?: string
    paths?: Record<string, unknown>
  }
  references?: Array<{ path?: string }>
  include?: string[]
}

async function inspectTypeScript(ctx: AnalysisContext): Promise<PluginMatch | null> {
  const raw = await ctx.readFile('tsconfig.json')
  if (raw === null) return { matched: true }
  let parsed: TsConfig
  try {
    parsed = JSON.parse(raw) as TsConfig
  } catch {
    return { matched: true }
  }
  const references = parsed.references?.map((r) => r.path).filter((p): p is string => !!p) ?? []
  const include = parsed.include ?? []
  const rootDir = parsed.compilerOptions?.rootDir
  const roots = [...new Set([...(rootDir ? [rootDir] : []), ...include])]
  return {
    matched: true,
    roots: roots.length > 0 ? roots : undefined,
    details: { references },
  }
}

async function loadTypeScriptOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const raw = await ctx.readFile('tsconfig.json')
  if (raw === null) return null
  let parsed: TsConfig
  try {
    parsed = JSON.parse(raw) as TsConfig
  } catch {
    return null
  }
  const c = parsed.compilerOptions ?? {}
  const rows: Array<{ key: string; value: string }> = []
  if (c.target) rows.push({ key: 'target', value: c.target })
  if (c.module) rows.push({ key: 'module', value: c.module })
  if (c.moduleResolution) rows.push({ key: 'moduleResolution', value: c.moduleResolution })
  if (c.jsx) rows.push({ key: 'jsx', value: c.jsx })
  if (typeof c.strict === 'boolean') rows.push({ key: 'strict', value: String(c.strict) })
  if (c.baseUrl) rows.push({ key: 'baseUrl', value: c.baseUrl })
  if (c.rootDir) rows.push({ key: 'rootDir', value: c.rootDir })

  const sections: OverviewSection[] = []
  if (rows.length > 0) {
    sections.push({ id: 'compiler', kind: 'key-value', title: 'compilerOptions', rows })
  }
  if (c.paths && Object.keys(c.paths).length > 0) {
    sections.push({
      id: 'paths',
      kind: 'list',
      title: 'paths',
      items: Object.keys(c.paths).map((label) => ({ label })),
    })
  }
  const references = parsed.references?.map((r) => r.path).filter((p): p is string => !!p) ?? []
  if (references.length > 0) {
    sections.push({
      id: 'references',
      kind: 'list',
      title: 'References',
      items: references.map((label) => ({ label })),
    })
  }
  if (sections.length === 0) {
    sections.push({
      id: 'detected',
      kind: 'status',
      title: 'TypeScript',
      tone: 'success',
      label: 'tsconfig.json present',
    })
  }
  return { pluginId: 'typescript', pluginName: 'TypeScript', icon: 'typescript', sections }
}

export const typescriptPlugin: AnalysisPlugin = {
  id: 'typescript',
  name: 'TypeScript',
  icon: 'typescript',
  patterns: [{ type: 'file-exists', paths: ['tsconfig.json'] }],
  inspect: inspectTypeScript,
  fileTypes: [
    {
      id: 'ts',
      label: 'TypeScript source',
      match: { extensions: ['ts'] },
      icon: 'typescript',
      preview: { kind: 'text', language: 'typescript' },
      priority: 10,
    },
    {
      id: 'tsx',
      label: 'TypeScript React',
      match: { extensions: ['tsx'] },
      icon: 'typescript',
      preview: { kind: 'text', language: 'typescript' },
      priority: 10,
    },
    {
      id: 'tsconfig',
      label: 'TypeScript config',
      match: { filenames: ['tsconfig.json'], pathGlobs: ['**/tsconfig.*.json'] },
      icon: 'typescript',
      preview: { kind: 'text', language: 'jsonc' },
      priority: 20,
    },
    {
      id: 'dts',
      label: 'TypeScript declaration',
      match: { pathGlobs: ['**/*.d.ts'] },
      icon: 'typescript',
      preview: { kind: 'text', language: 'typescript' },
      priority: 15,
    },
  ],
  loadOverview: loadTypeScriptOverview,
}

registerAnalysisPlugin(typescriptPlugin)
