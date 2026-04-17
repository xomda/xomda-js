/**
 * Minimal glob utilities used by the project walker and the xomda
 * plugin's subproject scan. Kept dep-free so @xomda/analysis-core
 * doesn't grow a runtime dependency.
 *
 *   - `**` crosses path separators
 *   - `*` matches within a single segment (no separators)
 */

/** Treat an entry as a glob if it contains `*`. */
export function isGlobPattern(entry: string): boolean {
  return entry.includes('*')
}

const GLOB_CACHE = new Map<string, RegExp>()

function compileGlob(glob: string): RegExp {
  const cached = GLOB_CACHE.get(glob)
  if (cached) return cached
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  // Two-pass swap: replace `**` with a placeholder first so the
  // subsequent `*` → `[^/]*` rewrite doesn't apply inside it, then
  // expand the placeholder to `.*`. A space is a safe placeholder
  // because the escape pass above doesn't touch it and the glob
  // alphabet itself never contains a literal space here.
  const pattern = escaped.replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*')
  const re = new RegExp(`^${pattern}$`)
  GLOB_CACHE.set(glob, re)
  return re
}

/**
 * Test whether `relPath` (project-relative POSIX, no leading `./`)
 * matches `glob`.
 */
export function matchesGlob(glob: string, relPath: string): boolean {
  return compileGlob(glob).test(relPath)
}

export interface ClassifiedExcludes {
  /** Basenames matched against folder names anywhere in the tree. */
  basenames: Set<string>
  /** Project-relative POSIX paths matched exactly. */
  paths: Set<string>
  /** Glob patterns matched against project-relative POSIX paths. */
  globs: string[]
}

/**
 * Split exclude entries by shape so walkers can route each entry to the
 * cheapest matcher:
 *   - contains `*` → glob (regex match per candidate path)
 *   - contains `/` → exact project-relative path match
 *   - otherwise → basename match (hash lookup, cheapest)
 *
 * Entries are normalised to POSIX and a leading `./` is stripped.
 */
export function classifyExcludes(entries: readonly string[]): ClassifiedExcludes {
  const basenames = new Set<string>()
  const paths = new Set<string>()
  const globs: string[] = []
  for (const raw of entries) {
    const entry = raw.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!entry) continue
    if (isGlobPattern(entry)) globs.push(entry)
    else if (entry.includes('/')) paths.add(entry)
    else basenames.add(entry)
  }
  return { basenames, paths, globs }
}
