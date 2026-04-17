import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

async function loadRustOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  if (!ctx.fileExists('Cargo.toml')) return null
  const raw = await ctx.readFile('Cargo.toml')
  // Best-effort identity from the [package] section.
  const name = raw?.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1]
  const version = raw?.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1]
  const edition = raw?.match(/^\s*edition\s*=\s*"([^"]+)"/m)?.[1]
  const rows: Array<{ key: string; value: string }> = []
  if (name) rows.push({ key: 'Name', value: name })
  if (version) rows.push({ key: 'Version', value: version })
  if (edition) rows.push({ key: 'Edition', value: edition })
  const sections: OverviewSection[] =
    rows.length > 0
      ? [{ id: 'identity', kind: 'key-value', title: 'Cargo package', rows }]
      : [
          {
            id: 'detected',
            kind: 'status',
            title: 'Rust',
            tone: 'success',
            label: 'Cargo.toml present',
          },
        ]
  return { pluginId: 'rust', pluginName: 'Rust', icon: 'rust', sections }
}

export const rustPlugin: AnalysisPlugin = {
  id: 'rust',
  name: 'Rust',
  icon: 'rust',
  patterns: [{ type: 'file-exists', paths: ['Cargo.toml'] }],
  fileTypes: [
    {
      id: 'cargo-toml',
      label: 'Cargo manifest',
      match: { filenames: ['Cargo.toml', 'Cargo.lock'] },
      icon: 'rust',
      preview: { kind: 'text', language: 'toml' },
      priority: 30,
    },
    {
      id: 'rust-source',
      label: 'Rust source',
      match: { extensions: ['rs'] },
      icon: 'rust',
      preview: { kind: 'text', language: 'rust' },
      priority: 10,
    },
  ],
  loadOverview: loadRustOverview,
}

registerAnalysisPlugin(rustPlugin)
