import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { XOMDA_DIR } from '@xomda/core'

/**
 * Result of resolving a `parentProject` path. Discriminated so callers can
 * surface the precise failure reason via `useNotificationsStore` rather than
 * a generic error.
 */
export type ParentProjectResolution =
  | { ok: true; absPath: string }
  | { ok: false; reason: ParentProjectRejectionReason; resolved?: string }

export type ParentProjectRejectionReason = 'escapes-project-root' | 'not-a-xomda-project'

interface ResolveOptions {
  /**
   * When true (default true at the schema layer), the resolved parent path
   * must live under the current `projectRoot`. When false, any reachable
   * directory may be a parent — useful for cross-repo workspaces but it
   * widens the read surface so the caller opts in explicitly.
   */
  restrictReadsToProjectRoot: boolean
}

/**
 * Resolve a `parentProject` path declared in `project.json`.
 *
 *   1. Normalise relative against `projectRoot` (or accept absolute as-is).
 *   2. Follow symlinks via `realpath` — a symlink pointing outside the
 *      sandbox cannot bypass the boundary check.
 *   3. If `restrictReadsToProjectRoot` is true, reject any resolved path
 *      that is not inside `projectRoot` (sibling and ancestor paths fail).
 *   4. Require a `.xomda/` directory inside the resolved path. A directory
 *      without it is not a xomda project — refuse to follow.
 *
 * Returns a discriminated result instead of throwing so callers can collect
 * warnings without aborting an entire project-graph build.
 */
export function resolveParentProject(
  projectRoot: string,
  parentRelative: string,
  options: ResolveOptions
): ParentProjectResolution {
  const resolved = isAbsolute(parentRelative)
    ? parentRelative
    : resolve(projectRoot, parentRelative)

  // Canonicalise both sides through realpath so symlink-based escapes are
  // caught. If a side doesn't exist, fall back to the lexical path — the
  // .xomda check below will reject it on its own merits.
  const realResolved = safeRealpath(resolved)
  const realRoot = safeRealpath(projectRoot)

  if (options.restrictReadsToProjectRoot && !isInside(realRoot, realResolved)) {
    return { ok: false, reason: 'escapes-project-root', resolved: realResolved }
  }

  if (!existsSync(join(realResolved, XOMDA_DIR))) {
    return { ok: false, reason: 'not-a-xomda-project', resolved: realResolved }
  }

  return { ok: true, absPath: realResolved }
}

function safeRealpath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
