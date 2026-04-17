import { dequal } from 'dequal'

/**
 * Canonical deep-equality check across the workspace.
 *
 * Wraps `dequal`. Use this — not `JSON.stringify(a) === JSON.stringify(b)`
 * (key-order sensitive, drops `undefined`, breaks on Date/Map/Set,
 * banned by AGENTS.md §32 / §"Bans"), and not hand-rolled recursive
 * equality (one consumer's correctness is everyone's).
 *
 * Symmetry, reflexivity, and key-order independence are pinned by the
 * spec next door.
 */
export function deepEqual<T>(a: T, b: T): boolean {
  return dequal(a, b)
}
