import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  type AnalysisContext,
  type AnalysisPlugin,
  type OverviewContribution,
  type OverviewSection,
  type PluginMatch,
  registerAnalysisPlugin,
} from '@xomda/analysis-core'

import { parsePom, type PomMeta } from './pom-parser'

function extractTagValue(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(xml)
  return match?.[1].trim()
}

async function loadMavenMeta(root: string): Promise<{ name: string; description?: string } | null> {
  try {
    const pom = await readFile(join(root, 'pom.xml'), 'utf-8')
    const artifactId = extractTagValue(pom, 'artifactId')
    if (!artifactId) return null
    const description = extractTagValue(pom, 'description')
    return description ? { name: artifactId, description } : { name: artifactId }
  } catch {
    return null
  }
}

async function inspectMaven(ctx: AnalysisContext): Promise<PluginMatch | null> {
  const pom = await ctx.readFile('pom.xml')
  if (pom === null) return { matched: true }
  // Defaults from the Maven super-POM.
  const sourceRoot = extractTagValue(pom, 'sourceDirectory') ?? 'src/main/java'
  const testRoot = extractTagValue(pom, 'testSourceDirectory') ?? 'src/test/java'
  return {
    matched: true,
    roots: [sourceRoot, testRoot],
    details: { sourceRoot, testRoot },
  }
}

function identitySection(meta: PomMeta): OverviewSection {
  const rows: Array<{ key: string; value: string }> = []
  if (meta.groupId) rows.push({ key: 'Group', value: meta.groupId })
  if (meta.artifactId) rows.push({ key: 'Artifact', value: meta.artifactId })
  if (meta.version) rows.push({ key: 'Version', value: meta.version })
  if (meta.packaging) rows.push({ key: 'Packaging', value: meta.packaging })
  if (meta.name) rows.push({ key: 'Name', value: meta.name })
  if (meta.description) rows.push({ key: 'Description', value: meta.description })
  return { id: 'identity', kind: 'key-value', title: 'Project', rows }
}

function dependenciesSection(meta: PomMeta): OverviewSection {
  return {
    id: 'deps',
    kind: 'table',
    title: 'Dependencies',
    columns: ['Group', 'Artifact', 'Version', 'Scope'],
    rows: meta.dependencies.map((d) => [
      d.groupId ?? '',
      d.artifactId,
      d.version ?? '',
      d.scope ?? 'compile',
    ]),
  }
}

function pluginsSection(meta: PomMeta): OverviewSection {
  return {
    id: 'plugins',
    kind: 'table',
    title: 'Build plugins',
    columns: ['Group', 'Artifact', 'Version'],
    rows: meta.plugins.map((p) => [
      p.groupId ?? 'org.apache.maven.plugins',
      p.artifactId,
      p.version ?? '',
    ]),
  }
}

function modulesSection(meta: PomMeta): OverviewSection {
  return {
    id: 'modules',
    kind: 'list',
    title: 'Modules',
    items: meta.modules.map((m) => ({ label: m })),
  }
}

function sourceRootsSection(meta: PomMeta): OverviewSection {
  return {
    id: 'roots',
    kind: 'key-value',
    title: 'Source roots',
    rows: [
      { key: 'Main', value: meta.sourceRoot ?? 'src/main/java' },
      { key: 'Test', value: meta.testSourceRoot ?? 'src/test/java' },
    ],
  }
}

async function loadMavenOverview(ctx: AnalysisContext): Promise<OverviewContribution | null> {
  const pom = await ctx.readFile('pom.xml')
  if (!pom) return null
  const meta = parsePom(pom)
  const sections: OverviewSection[] = [identitySection(meta)]
  if (meta.modules.length > 0) sections.push(modulesSection(meta))
  if (meta.dependencies.length > 0) sections.push(dependenciesSection(meta))
  if (meta.plugins.length > 0) sections.push(pluginsSection(meta))
  sections.push(sourceRootsSection(meta))
  return {
    pluginId: 'maven',
    pluginName: 'Apache Maven',
    icon: 'maven',
    sections,
  }
}

export const mavenPlugin: AnalysisPlugin = {
  id: 'maven',
  name: 'Apache Maven',
  icon: 'maven',
  patterns: [{ type: 'file-exists', paths: ['pom.xml'] }],
  inspect: inspectMaven,
  fileTypes: [
    {
      id: 'pom',
      label: 'Maven POM',
      match: { filenames: ['pom.xml'] },
      icon: 'maven',
      views: [
        { id: 'source', label: 'Source', preview: { kind: 'text', language: 'xml' } },
        {
          id: 'info',
          label: 'Info',
          preview: { kind: 'custom', componentId: 'maven-pom-info' },
          loadViewData: async (ctx, relativePath) => {
            const pom = await ctx.readFile(relativePath)
            if (!pom) return null
            return parsePom(pom)
          },
        },
      ],
      priority: 30,
    },
    {
      id: 'java',
      label: 'Java source',
      match: { extensions: ['java'] },
      icon: 'java',
      preview: { kind: 'text', language: 'java' },
      priority: 10,
    },
  ],
  projectKind: {
    marker: 'pom.xml',
    loadMeta: loadMavenMeta,
  },
  loadOverview: loadMavenOverview,
}

registerAnalysisPlugin(mavenPlugin)
