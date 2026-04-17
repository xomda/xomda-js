/**
 * Resolve a relative workspace-internal path. Used by the file browser
 * to decide whether a link in a previewed file (e.g. a relative link in
 * a `.md`) points at another file inside the project — in which case
 * the host can navigate to it — or escapes the project root, in which
 * case the click must be refused.
 *
 * POSIX-style: forward slashes only. Inputs that look absolute (`/foo`),
 * platform-rooted (`C:\\foo`), or carry a URL scheme are rejected
 * outright by returning `null`. A path that walks above the workspace
 * root via `..` also returns `null`.
 *
 * `fromFilePath` is the file the link is *in*, not a directory. The
 * basename is stripped before joining so `./other.md` from `docs/a.md`
 * resolves to `docs/other.md`, not `docs/a.md/other.md`.
 *
 * Returns the resolved workspace-relative POSIX path on success
 * (without a leading `./`), or `null` when the target escapes the
 * workspace or is not a workspace-relative reference.
 */
export function resolveWorkspaceRelative(
  fromFilePath: string,
  relativePath: string
): string | null {
  if (typeof relativePath !== 'string') return null
  const trimmed = relativePath.trim()
  if (trimmed === '') return null

  // Absolute POSIX, Windows drive, UNC, or any URL scheme → not a
  // workspace-relative reference, treat as outside.
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return null
  if (/^[a-z]:[\\/]/i.test(trimmed)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null

  // Normalise separators and strip the URL fragment / query — those
  // aren't part of the on-disk path.
  const noQuery = trimmed.replace(/\\/g, '/').replace(/[?#].*$/, '')
  if (noQuery === '') return null

  const fromNorm = fromFilePath.replace(/\\/g, '/')
  const fromDir = fromNorm.includes('/') ? fromNorm.slice(0, fromNorm.lastIndexOf('/')) : ''

  const baseSegs = fromDir === '' || fromDir === '.' ? [] : fromDir.split('/').filter(Boolean)
  const segs = noQuery.split('/').filter((s) => s !== '')

  const out: string[] = [...baseSegs]
  for (const s of segs) {
    if (s === '.') continue
    if (s === '..') {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(s)
  }
  return out.join('/')
}
