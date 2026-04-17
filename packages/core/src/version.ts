export type VersionPart = 'major' | 'minor' | 'patch'

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  /** How many segments the source string had: '1' → 1, '1.2' → 2, '1.2.3' → 3. */
  parts: 1 | 2 | 3
}

const VERSION_RE = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/

export function parseVersion(v: string | null | undefined): ParsedVersion | null {
  if (v == null) return null
  const m = VERSION_RE.exec(v.trim())
  if (!m) return null
  const major = Number(m[1])
  const hasMinor = m[2] !== undefined
  const hasPatch = m[3] !== undefined
  const minor = hasMinor ? Number(m[2]) : 0
  const patch = hasPatch ? Number(m[3]) : 0
  const parts: 1 | 2 | 3 = hasPatch ? 3 : hasMinor ? 2 : 1
  return { major, minor, patch, parts }
}

export function isValidVersion(v: string | null | undefined): boolean {
  return parseVersion(v) != null
}

export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1
  return 0
}

/**
 * Bump a version. Without `part`, bumps the smallest available segment:
 *   '1' → '2', '1.2' → '1.3', '1.2.3' → '1.2.4'.
 * Returns null if the input is not a valid version.
 */
export function bumpVersion(v: string, part?: VersionPart): string | null {
  const p = parseVersion(v)
  if (!p) return null
  const target: VersionPart =
    part ?? (p.parts === 1 ? 'major' : p.parts === 2 ? 'minor' : 'patch')
  let { major, minor, patch } = p
  if (target === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (target === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
  if (p.parts === 1) return `${major}`
  if (p.parts === 2) return `${major}.${minor}`
  return `${major}.${minor}.${patch}`
}

/** Returns the maximum parseable version in the list, or null if none parse. */
export function maxVersion(versions: ReadonlyArray<string>): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (!isValidVersion(v)) continue
    if (best == null || compareVersions(v, best) === 1) best = v
  }
  return best
}

/**
 * Returns an error message if `upcoming` is not a valid next version after `current`,
 * also enforcing strict-greater than every parseable entry in `historical`.
 * Returns null if valid.
 */
export function validateUpcomingVersion(
  upcoming: string,
  current: string,
  historical: ReadonlyArray<string> = []
): string | null {
  if (!upcoming || !upcoming.trim()) return 'Upcoming version is required'
  if (!isValidVersion(upcoming)) return 'Not a valid version (expected e.g. 1.2.3)'
  if (isValidVersion(current) && compareVersions(upcoming, current) !== 1) {
    return `Must be greater than ${current}`
  }
  const max = maxVersion(historical)
  if (max && compareVersions(upcoming, max) !== 1) {
    return `Must be greater than previous version ${max}`
  }
  return null
}

/**
 * Returns an error message if `next` is lower than any known historical version,
 * or not a valid version. Equal to a historical version is allowed (metadata edits).
 * Returns null if valid.
 */
export function validateModelVersionEdit(
  next: string,
  historical: ReadonlyArray<string> = []
): string | null {
  if (!next || !next.trim()) return 'Version is required'
  if (!isValidVersion(next)) return 'Not a valid version (expected e.g. 1.2.3)'
  const max = maxVersion(historical)
  if (max && compareVersions(next, max) === -1) {
    return `Cannot be lower than previous version ${max}`
  }
  return null
}
