/**
 * Visibility classifies who can resolve a reference to an Entity or Package
 * across the project graph:
 *
 * - `'public'`           — visible across the entire project graph (current
 *                          project + parent-project chain).
 * - `'package-private'`  — visible within the defining package and its
 *                          descendant packages, across all models in the same
 *                          project.
 * - `'model-private'`    — visible only within the defining model.
 *
 * Legacy entities and packages parsed without a `visibility` key are treated
 * as `'public'`. This preserves the pre-visibility behaviour where
 * cross-model lookups did not exist, so legacy entities were trivially visible
 * everywhere. New entities and packages created through the API (router /
 * UI) default to `'package-private'` — see plan D4 for the rationale.
 */
export const VISIBILITY_VALUES = ['public', 'package-private', 'model-private'] as const
export type Visibility = (typeof VISIBILITY_VALUES)[number]

const VISIBILITY_RANK: Record<Visibility, number> = {
  'model-private': 0,
  'package-private': 1,
  public: 2,
}

/**
 * Effective (own) visibility of a target — falls back to `'public'` when the
 * `visibility` key is absent. Pure read helper; no package-chain walk yet
 * (that lives in `getEffectiveVisibility` once a containing package chain is
 * provided alongside, in phase D2 / F).
 */
export const getOwnVisibility = (target: { visibility?: Visibility }): Visibility =>
  target.visibility ?? 'public'

/**
 * Most-restrictive of two visibilities. Used by the package-chain walk to
 * narrow an entity's effective visibility against each enclosing package.
 */
export const minVisibility = (a: Visibility, b: Visibility): Visibility =>
  VISIBILITY_RANK[a] <= VISIBILITY_RANK[b] ? a : b

/**
 * Effective visibility of a target considering its enclosing-package chain.
 * The result is MIN of (target's own visibility) and each enclosing package's
 * visibility. A package marked `model-private` narrows everything inside it
 * to at least `model-private`; a `package-private` package narrows down to at
 * most `package-private`; etc.
 *
 * `packageChain` should be ordered nearest-package-first (target's immediate
 * container first, then its parent, up to the root package). Order does not
 * affect the result because `minVisibility` is associative, but the
 * convention keeps caller code consistent.
 */
export const getEffectiveVisibility = (
  target: { visibility?: Visibility },
  packageChain: ReadonlyArray<{ visibility?: Visibility }>
): Visibility => {
  let v = getOwnVisibility(target)
  for (const pkg of packageChain) v = minVisibility(v, getOwnVisibility(pkg))
  return v
}

/**
 * Result of a cross-context visibility check. The current locked semantics
 * (plan D4) say: same model is always visible; cross-model resolution
 * applies the effective visibility check below.
 */
export interface VisibilityCheck {
  /**
   * Target's effective visibility (with package chain already collapsed via
   * `getEffectiveVisibility`).
   */
  effective: Visibility
  /**
   * UUID of the model the target lives in.
   */
  targetModelId: string
  /**
   * UUID of the immediate package the target lives in, or `null` when the
   * target is defined at the model root (no enclosing package).
   */
  targetPackageId: string | null
  /**
   * UUID of the model the consumer (the caller initiating the lookup) lives
   * in. When equal to `targetModelId`, the visibility check short-circuits to
   * `true`.
   */
  consumerModelId: string
  /**
   * Ordered chain of package UUIDs containing the consumer, nearest-first
   * (consumer's own package first, then its parent packages). Empty when the
   * consumer is at the model root. Used only when the target is
   * `package-private`.
   */
  consumerPackageChainIds: ReadonlyArray<string>
  /**
   * Optional UUID of the consumer's project. Used to distinguish same-project
   * from cross-project lookups once the project graph is wired up. For now,
   * same-project is assumed when omitted.
   */
  consumerProjectId?: string
  /**
   * Optional UUID of the target's project. Same semantics as
   * `consumerProjectId`.
   */
  targetProjectId?: string
}

/**
 * Decides whether a target is visible from a consumer context.
 *
 *   - Same model               → always visible.
 *   - Different model, same project:
 *     - `'public'`              → visible.
 *     - `'package-private'`     → visible iff the consumer's package chain
 *                                 contains the target's defining package.
 *     - `'model-private'`       → not visible.
 *   - Different project:
 *     - `'public'`              → visible.
 *     - otherwise               → not visible.
 *
 * Pure rule function — does not walk models or fetch packages. Callers prepare
 * a `VisibilityCheck` first, typically with `getEffectiveVisibility` for the
 * `effective` field.
 */
export const isVisibleFrom = (check: VisibilityCheck): boolean => {
  if (check.consumerModelId === check.targetModelId) return true

  const crossProject =
    check.consumerProjectId !== undefined &&
    check.targetProjectId !== undefined &&
    check.consumerProjectId !== check.targetProjectId

  if (check.effective === 'model-private') return false
  if (check.effective === 'public') return true
  // 'package-private'
  if (crossProject) return false
  if (check.targetPackageId === null) return false
  return check.consumerPackageChainIds.includes(check.targetPackageId)
}
