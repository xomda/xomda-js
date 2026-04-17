import { isAbsolute, relative, resolve } from 'node:path'

import type { ProjectSettings } from '@xomda/core'

export interface WriteTarget {
  /** The absolute path the caller should write to. */
  path: string
}

export class WriteOutsideProjectRootError extends Error {
  readonly target: string
  readonly projectRoot: string
  constructor(target: string, projectRoot: string) {
    super(`Refusing to write outside project root: ${target} (root: ${projectRoot})`)
    this.name = 'WriteOutsideProjectRootError'
    this.target = target
    this.projectRoot = projectRoot
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Decide where a write should land given the project's sandbox setting:
 *   - target inside projectRoot                  → use it as-is
 *   - target outside, restrictWrites = false     → use it as-is
 *   - target outside, restrictWrites = true      → throw
 *
 * The error is intentionally hard — no silent redirect. Callers (CLI,
 * tRPC mutations) can catch and surface the violation to the user.
 */
export function resolveWriteTarget(
  target: string,
  projectRoot: string | null,
  settings: ProjectSettings
): WriteTarget {
  const abs = isAbsolute(target) ? target : resolve(projectRoot ?? process.cwd(), target)
  if (projectRoot && isInside(projectRoot, abs)) {
    return { path: abs }
  }
  if (!settings.restrictWritesToProjectRoot) {
    return { path: abs }
  }
  throw new WriteOutsideProjectRootError(abs, projectRoot ?? '<none>')
}
