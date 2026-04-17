/**
 * Read-only inspection of a Node project's package.json. Extracts the
 * subset we surface in the overview pane and the package.json "Info"
 * tab: identity, scripts, dependency tables (regular / dev / peer /
 * optional), workspaces, and the detected package manager + runtime.
 */

export interface NodePackageMeta {
  name?: string
  version?: string
  description?: string
  license?: string
  type?: string
  main?: string
  module?: string
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
  optionalDependencies: Record<string, string>
  workspaces: string[]
  packageManager?: string
  engines: Record<string, string>
}

function recordOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function workspacesOf(value: unknown): string[] {
  // `workspaces` may be a string array OR `{ packages: [...] }`.
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === 'string')
  if (value && typeof value === 'object') {
    const packages = (value as { packages?: unknown }).packages
    if (Array.isArray(packages)) {
      return packages.filter((s): s is string => typeof s === 'string')
    }
  }
  return []
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function parsePackageJson(json: string): NodePackageMeta | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  return {
    name: stringOrUndefined(parsed.name),
    version: stringOrUndefined(parsed.version),
    description: stringOrUndefined(parsed.description),
    license: stringOrUndefined(parsed.license),
    type: stringOrUndefined(parsed.type),
    main: stringOrUndefined(parsed.main),
    module: stringOrUndefined(parsed.module),
    scripts: recordOf(parsed.scripts),
    dependencies: recordOf(parsed.dependencies),
    devDependencies: recordOf(parsed.devDependencies),
    peerDependencies: recordOf(parsed.peerDependencies),
    optionalDependencies: recordOf(parsed.optionalDependencies),
    workspaces: workspacesOf(parsed.workspaces),
    packageManager: stringOrUndefined(parsed.packageManager),
    engines: recordOf(parsed.engines),
  }
}

export interface DetectedPackageManager {
  /** Friendly label, e.g. "pnpm 10.x" or "yarn (lockfile detected)". */
  label: string
  /** Where the detection came from. */
  source: 'packageManager' | 'pnpm-lock.yaml' | 'yarn.lock' | 'package-lock.json' | 'bun.lockb'
}

/**
 * Infer the package manager from `package.json#packageManager` first
 * (the modern canonical source), then fall back to lockfile presence.
 * Returns null when neither signal is available.
 */
export async function detectPackageManager(
  meta: NodePackageMeta,
  fileExists: (relativePath: string) => boolean
): Promise<DetectedPackageManager | null> {
  if (meta.packageManager) {
    return { label: meta.packageManager, source: 'packageManager' }
  }
  if (fileExists('pnpm-lock.yaml'))
    return { label: 'pnpm (lockfile detected)', source: 'pnpm-lock.yaml' }
  if (fileExists('yarn.lock')) return { label: 'yarn (lockfile detected)', source: 'yarn.lock' }
  if (fileExists('bun.lockb')) return { label: 'bun (lockfile detected)', source: 'bun.lockb' }
  if (fileExists('package-lock.json')) {
    return { label: 'npm (lockfile detected)', source: 'package-lock.json' }
  }
  return null
}
