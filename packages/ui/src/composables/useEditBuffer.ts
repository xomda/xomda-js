import { dequal } from 'dequal'
import { computed, type ComputedRef, type Ref, ref, toRaw, type WritableComputedRef } from 'vue'

export interface EditBuffer<T> {
  /**
   * The live, editable draft. Bind this to form fields. Reactive — mutations
   * through `draft.value = …` or property assignments deep-track via Vue.
   */
  draft: Ref<T | null>
  /**
   * The last committed source — what `dirty` compares the draft against.
   * Read-only by convention (mutations should go through `set` / `commit`).
   * Useful when a view needs to know "what is currently selected" as
   * distinct from "what is being edited".
   */
  baseline: Readonly<Ref<T | null>>
  /** True when `draft` differs from the last committed source (deep equality). */
  dirty: ComputedRef<boolean>
  /** Replace the source — typically called after a successful save. Resets `draft` to a fresh clone. */
  set: (next: T | null) => void
  /**
   * Replace the baseline without touching the draft. Use when the server's
   * truth changed (rename, move, post-save echo) but the user has unsaved
   * edits in `draft` you must not clobber. `dirty` recomputes against the
   * new baseline — a was-dirty buffer stays dirty iff the draft still
   * differs; a was-clean buffer flips dirty iff the new baseline differs.
   */
  setBaselineOnly: (next: T | null) => void
  /** Discard local edits and reset `draft` back to a fresh clone of the source. */
  revert: () => void
  /** Commit `draft` as the new source (the new "saved" baseline). No-op if `draft` is null. */
  commit: () => void
  /**
   * Sugar for two-way binding into v-model-style props. Reads return the
   * draft; writes go straight into `draft.value`. Useful when a child form
   * expects a writable ref but the parent owns the buffer.
   */
  model: WritableComputedRef<T | null>
}

/**
 * Per-field edit buffer with dirty-tracking and revert.
 *
 * Replaces the `originalX = JSON.parse(JSON.stringify(X))` + `dirty = computed
 * (JSON.stringify(a) !== JSON.stringify(b))` pattern that repeats across views.
 * The JSON-based version is broken on key reorder and silently drops
 * `undefined`; this composable uses {@link structuredClone} + {@link dequal}
 * to track changes structurally.
 *
 * Typical usage:
 *
 * ```ts
 * const entityBuffer = useEditBuffer<Entity>(null)
 * function selectEntity(e: Entity) { entityBuffer.set(e) }
 * async function save() {
 *   if (!entityBuffer.draft.value || !entityBuffer.dirty.value) return
 *   const updated = await trpc.model.updateEntity.mutate(entityBuffer.draft.value)
 *   entityBuffer.set(updated) // new baseline
 * }
 * ```
 */
export function useEditBuffer<T>(initial: T | null = null): EditBuffer<T> {
  const baseline = ref<T | null>(deepCopy(initial)) as Ref<T | null>
  const draft = ref<T | null>(deepCopy(initial)) as Ref<T | null>

  const dirty = computed(() => !dequal(baseline.value, draft.value))

  function set(next: T | null) {
    // Atomic: one clone of the caller's input, then a clone of THAT clone
    // for the draft so the two refs are structurally separate. If the first
    // deepCopy throws (cyclic + non-serialisable input on the JSON fallback,
    // a non-deterministic getter, etc.) we leave both refs untouched —
    // baseline and draft cannot disagree.
    const cloned = deepCopy(next)
    const draftCopy = deepCopy(cloned)
    baseline.value = cloned
    draft.value = draftCopy
  }

  function setBaselineOnly(next: T | null) {
    baseline.value = deepCopy(next)
  }

  function revert() {
    draft.value = deepCopy(baseline.value)
  }

  function commit() {
    if (draft.value === null) return
    baseline.value = deepCopy(draft.value)
  }

  const model = computed({
    get: () => draft.value,
    set: (v) => {
      draft.value = v
    },
  })

  return { draft, baseline, dirty, set, setBaselineOnly, revert, commit, model }
}

/**
 * Deep-clone a value. Strips Vue's reactive proxy first (`toRaw`) — without
 * that step `structuredClone` throws `DataCloneError` on getter/setter traps.
 *
 * Two cloning strategies are tried in order:
 *
 * 1. **`structuredClone`** — preserves Date, Map, Set, RegExp, ArrayBuffer,
 *    typed arrays, nested arrays/objects, and handles cyclic graphs. The
 *    default path on every modern runtime (Node 17+, all current browsers).
 * 2. **JSON round-trip** — fallback for hostile runtimes or when the input
 *    contains a value `structuredClone` rejects (functions, Symbols,
 *    DOM nodes). Drops `undefined` properties and unsupported types; this
 *    is intentional: such values can't be persisted via tRPC anyway.
 *
 * In either case, the returned object is decoupled from Vue's reactive
 * baseline so callers can mutate the draft freely without touching the
 * dirty-tracking source.
 */
function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const raw = toRaw(value) as T
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(raw)
    } catch {
      // Fall through to the JSON path for non-cloneable payloads.
    }
  }
  return JSON.parse(JSON.stringify(raw)) as T
}
