/**
 * Format a POSIX file-mode bitmask (the low 9 bits of `stats.mode` from
 * `fs.stat`) as a three-digit octal string, e.g. `0o644` → `'644'`.
 *
 * Only the rwx bits for owner/group/other are considered. Setuid/setgid/
 * sticky and the file-type bits above 0o777 are intentionally dropped —
 * the caller already has `isDirectory` from `stats` if it needs it.
 */
export function modeToOctal(mode: number): string {
  const octal = (mode & 0o777).toString(8)
  return octal.padStart(3, '0')
}

/**
 * Format a POSIX file-mode bitmask as the 10-character symbolic string
 * `ls -l` shows: `-rw-r--r--`, `drwxr-xr-x`, etc. The first character is
 * `d` for directories and `-` for everything else; the next nine are
 * three rwx triplets for owner/group/other. Missing permissions are
 * rendered as `-`.
 *
 * The `@` extended-attribute suffix that macOS ls renders is intentionally
 * not included — probing xattrs requires a separate stat-like call and is
 * out of scope for a display-only helper.
 */
export function modeToSymbolic(mode: number, isDirectory: boolean): string {
  const bits = mode & 0o777
  const triplet = (shift: number) => {
    const r = (bits >> (shift + 2)) & 1 ? 'r' : '-'
    const w = (bits >> (shift + 1)) & 1 ? 'w' : '-'
    const x = (bits >> shift) & 1 ? 'x' : '-'
    return `${r}${w}${x}`
  }
  return `${isDirectory ? 'd' : '-'}${triplet(6)}${triplet(3)}${triplet(0)}`
}
