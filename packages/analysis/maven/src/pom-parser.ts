/**
 * Pragmatic regex-based POM parser. Maven POMs use a strict, well-known
 * shape and the consuming UI only needs identity + dependency/plugin
 * tables for read-only display — we deliberately avoid pulling in a
 * full XML parser. Edge cases (CDATA, comments wrapped around tags) are
 * accepted as best-effort.
 */

export interface PomCoordinate {
  groupId?: string
  artifactId: string
  version?: string
  scope?: string
}

export interface PomMeta {
  groupId?: string
  artifactId?: string
  version?: string
  name?: string
  description?: string
  packaging?: string
  modules: string[]
  dependencies: PomCoordinate[]
  plugins: PomCoordinate[]
  sourceRoot?: string
  testSourceRoot?: string
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml)
  return match?.[1].trim()
}

function extractAll(xml: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

function parseCoordinates(blocks: string[]): PomCoordinate[] {
  return blocks
    .map((block): PomCoordinate | null => {
      const artifactId = extractTag(block, 'artifactId')
      if (!artifactId) return null
      const out: PomCoordinate = { artifactId }
      const groupId = extractTag(block, 'groupId')
      if (groupId) out.groupId = groupId
      const version = extractTag(block, 'version')
      if (version) out.version = version
      const scope = extractTag(block, 'scope')
      if (scope) out.scope = scope
      return out
    })
    .filter((c): c is PomCoordinate => c !== null)
}

/**
 * Strip the top-level `<parent>…</parent>` block so the parent's
 * groupId/artifactId/version don't leak into the child's identity.
 */
function withoutParentBlock(xml: string): string {
  return xml.replace(/<parent>[\s\S]*?<\/parent>/, '')
}

/**
 * Extract <dependency> entries that live directly under the top-level
 * <dependencies> (i.e. excluding <dependencyManagement>) by removing
 * the management block first.
 */
function findDirectDependencyBlocks(xml: string): string[] {
  const withoutManagement = xml.replace(
    /<dependencyManagement>[\s\S]*?<\/dependencyManagement>/,
    ''
  )
  const depsBlock = extractTag(withoutManagement, 'dependencies')
  if (!depsBlock) return []
  return extractAll(depsBlock, 'dependency')
}

function findBuildPluginBlocks(xml: string): string[] {
  const build = extractTag(xml, 'build')
  if (!build) return []
  const plugins = extractTag(build, 'plugins')
  if (!plugins) return []
  return extractAll(plugins, 'plugin')
}

function findModuleNames(xml: string): string[] {
  const block = extractTag(xml, 'modules')
  if (!block) return []
  return extractAll(block, 'module').map((m) => m.trim())
}

export function parsePom(xml: string): PomMeta {
  const withoutParent = withoutParentBlock(xml)
  const sourceRoot = extractTag(xml, 'sourceDirectory')
  const testSourceRoot = extractTag(xml, 'testSourceDirectory')
  return {
    groupId: extractTag(withoutParent, 'groupId') ?? extractTag(xml, 'groupId'),
    artifactId: extractTag(withoutParent, 'artifactId') ?? extractTag(xml, 'artifactId'),
    version: extractTag(withoutParent, 'version') ?? extractTag(xml, 'version'),
    name: extractTag(xml, 'name'),
    description: extractTag(xml, 'description'),
    packaging: extractTag(xml, 'packaging'),
    modules: findModuleNames(xml),
    dependencies: parseCoordinates(findDirectDependencyBlocks(xml)),
    plugins: parseCoordinates(findBuildPluginBlocks(xml)),
    ...(sourceRoot ? { sourceRoot } : {}),
    ...(testSourceRoot ? { testSourceRoot } : {}),
  }
}
