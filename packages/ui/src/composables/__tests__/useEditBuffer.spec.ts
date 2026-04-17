import { describe, expect, it } from 'vitest'

import { useEditBuffer } from '../useEditBuffer'

interface Sample {
  id: string
  name: string
  meta?: { tag?: string }
}

describe('useEditBuffer', () => {
  it('starts clean with the initial value cloned', () => {
    const source: Sample = { id: '1', name: 'first' }
    const buf = useEditBuffer<Sample>(source)
    expect(buf.draft.value).toEqual(source)
    expect(buf.draft.value).not.toBe(source) // structuredClone
    expect(buf.dirty.value).toBe(false)
  })

  it('starts with null when no initial is provided', () => {
    const buf = useEditBuffer<Sample>()
    expect(buf.draft.value).toBeNull()
    expect(buf.dirty.value).toBe(false)
  })

  it('marks dirty after mutating the draft', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'first' })
    if (buf.draft.value) buf.draft.value.name = 'second'
    expect(buf.dirty.value).toBe(true)
  })

  it('marks dirty on deep-nested edits', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x', meta: { tag: 'a' } })
    if (buf.draft.value?.meta) buf.draft.value.meta.tag = 'b'
    expect(buf.dirty.value).toBe(true)
  })

  it('stays clean when edited then reverted to identical content', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    if (buf.draft.value) buf.draft.value.name = 'y'
    expect(buf.dirty.value).toBe(true)
    if (buf.draft.value) buf.draft.value.name = 'x'
    expect(buf.dirty.value).toBe(false)
  })

  it('does NOT mark dirty just from key reorder (deep equality)', () => {
    // This is the bug that the JSON.stringify-based dirty check has.
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x', meta: { tag: 'a' } })
    if (buf.draft.value) {
      const { id, name, meta } = buf.draft.value
      buf.draft.value = { name, id, meta } as Sample // reorder keys
    }
    expect(buf.dirty.value).toBe(false)
  })

  it('set() replaces source and clones a fresh draft', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    if (buf.draft.value) buf.draft.value.name = 'edited'
    expect(buf.dirty.value).toBe(true)

    buf.set({ id: '2', name: 'y' })
    expect(buf.draft.value).toEqual({ id: '2', name: 'y' })
    expect(buf.dirty.value).toBe(false)
  })

  it('set(null) clears the buffer', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    buf.set(null)
    expect(buf.draft.value).toBeNull()
    expect(buf.dirty.value).toBe(false)
  })

  it('revert() restores the draft to the source clone', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    if (buf.draft.value) buf.draft.value.name = 'edited'
    buf.revert()
    expect(buf.draft.value).toEqual({ id: '1', name: 'x' })
    expect(buf.dirty.value).toBe(false)
  })

  describe('setBaselineOnly()', () => {
    it('updates baseline without touching draft', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      if (buf.draft.value) buf.draft.value.name = 'edited'
      const draftBefore = buf.draft.value
      buf.setBaselineOnly({ id: '1', name: 'server-renamed' })
      expect(buf.draft.value).toBe(draftBefore)
      expect(buf.draft.value?.name).toBe('edited')
    })

    it('keeps a dirty buffer dirty when draft still differs from new baseline', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      if (buf.draft.value) buf.draft.value.name = 'edited'
      expect(buf.dirty.value).toBe(true)
      buf.setBaselineOnly({ id: '1', name: 'server-renamed' })
      expect(buf.dirty.value).toBe(true)
    })

    it('flips a clean buffer to dirty when the new baseline differs from draft', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      expect(buf.dirty.value).toBe(false)
      buf.setBaselineOnly({ id: '1', name: 'server-renamed' })
      expect(buf.dirty.value).toBe(true)
    })

    it('after setBaselineOnly, revert() restores to the new baseline', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      if (buf.draft.value) buf.draft.value.name = 'edited'
      buf.setBaselineOnly({ id: '1', name: 'server-renamed' })
      buf.revert()
      expect(buf.draft.value?.name).toBe('server-renamed')
      expect(buf.dirty.value).toBe(false)
    })

    it('setBaselineOnly(null) clears baseline, draft preserved', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      buf.setBaselineOnly(null)
      expect(buf.baseline.value).toBeNull()
      expect(buf.draft.value).toEqual({ id: '1', name: 'x' })
      expect(buf.dirty.value).toBe(true)
    })

    it('deep-clones the input so later mutations do not leak in', () => {
      const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
      const next: Sample = { id: '1', name: 'server', meta: { tag: 'a' } }
      buf.setBaselineOnly(next)
      if (next.meta) next.meta.tag = 'mutated-after'
      // baseline is read-only by convention — the clone must be independent
      // so callers can keep mutating the input without disturbing dirty.
      buf.draft.value = { id: '1', name: 'server', meta: { tag: 'a' } }
      expect(buf.dirty.value).toBe(false)
    })
  })

  it('commit() promotes the current draft to be the new baseline', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    if (buf.draft.value) buf.draft.value.name = 'y'
    buf.commit()
    expect(buf.dirty.value).toBe(false)
    // Mutating again from the new baseline goes dirty.
    if (buf.draft.value) buf.draft.value.name = 'z'
    expect(buf.dirty.value).toBe(true)
    buf.revert()
    expect(buf.draft.value?.name).toBe('y')
  })

  it('commit() is a no-op when draft is null', () => {
    const buf = useEditBuffer<Sample>()
    expect(() => buf.commit()).not.toThrow()
    expect(buf.draft.value).toBeNull()
  })

  it('model writable computed proxies draft reads and writes', () => {
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x' })
    expect(buf.model.value).toEqual(buf.draft.value)
    buf.model.value = { id: '1', name: 'replaced' }
    expect(buf.draft.value?.name).toBe('replaced')
    expect(buf.dirty.value).toBe(true)
  })

  it('treats `undefined` and missing optional consistently (no spurious dirty)', () => {
    // JSON.stringify drops `undefined` — the structuredClone-based version
    // preserves the shape so dequal treats them as equal.
    const buf = useEditBuffer<Sample>({ id: '1', name: 'x', meta: undefined })
    if (buf.draft.value) buf.draft.value.meta = undefined
    expect(buf.dirty.value).toBe(false)
  })

  describe('value-type coverage', () => {
    it('arrays as top-level T — element edit marks dirty', () => {
      const buf = useEditBuffer<number[]>([1, 2, 3])
      expect(buf.dirty.value).toBe(false)
      if (buf.draft.value) buf.draft.value[1] = 99
      expect(buf.dirty.value).toBe(true)
    })

    it('array reorder counts as a change (preserves order semantics)', () => {
      const buf = useEditBuffer<number[]>([1, 2, 3])
      buf.draft.value = [3, 2, 1]
      expect(buf.dirty.value).toBe(true)
    })

    it('Date values survive cloning and equality-check', () => {
      type Sample = { at: Date }
      const source = { at: new Date('2024-01-01T00:00:00Z') }
      const buf = useEditBuffer<Sample>(source)
      // Clone is a separate Date instance (mutating the source must not
      // leak into the draft) but with the same wall time.
      expect(buf.draft.value?.at).not.toBe(source.at)
      expect(buf.draft.value?.at.getTime()).toBe(source.at.getTime())
      expect(buf.dirty.value).toBe(false)
      if (buf.draft.value) buf.draft.value.at = new Date('2024-06-01T00:00:00Z')
      expect(buf.dirty.value).toBe(true)
    })

    it('Map preserved through structuredClone path', () => {
      type Sample = { tags: Map<string, number> }
      const buf = useEditBuffer<Sample>({
        tags: new Map([
          ['x', 1],
          ['y', 2],
        ]),
      })
      expect(buf.dirty.value).toBe(false)
      if (buf.draft.value) buf.draft.value.tags.set('z', 3)
      expect(buf.dirty.value).toBe(true)
    })

    it('Set preserved through structuredClone path', () => {
      type Sample = { ids: Set<string> }
      const buf = useEditBuffer<Sample>({ ids: new Set(['a', 'b']) })
      if (buf.draft.value) buf.draft.value.ids.add('c')
      expect(buf.dirty.value).toBe(true)
    })

    it('falls back to JSON path when source contains a function (dropped silently)', () => {
      // The JSON fallback is documented to drop functions/Symbols — verify
      // that the buffer still works (no exception) for such inputs even if
      // some properties get lost in the clone.
      const fn = () => 'no'
      const buf = useEditBuffer<Record<string, unknown>>({ name: 'x', op: fn })
      expect(buf.draft.value?.name).toBe('x')
      // Function dropped during clone — the contract says don't crash, and
      // don't claim dirty for what was never preserved.
      expect(buf.dirty.value).toBe(false)
    })

    it('numeric primitive T — pure replacement', () => {
      const buf = useEditBuffer<number>(7)
      expect(buf.draft.value).toBe(7)
      buf.draft.value = 8
      expect(buf.dirty.value).toBe(true)
      buf.revert()
      expect(buf.draft.value).toBe(7)
    })

    it('string primitive T — pure replacement', () => {
      const buf = useEditBuffer<string>('hello')
      buf.draft.value = 'world'
      expect(buf.dirty.value).toBe(true)
      buf.set('world')
      expect(buf.dirty.value).toBe(false)
    })

    it('set() with a non-deterministic clone keeps baseline and draft in agreement', () => {
      // Real-world scenario: an input with a getter (or Proxy) that succeeds
      // on the first deepCopy call and throws on the second. The previous
      // implementation called deepCopy twice independently — baseline could
      // be set from the first clone while the second clone threw, leaving
      // draft at its old value. dirty.value would then report true forever
      // even though nothing was edited.
      const buf = useEditBuffer<{ id: string; name: string }>({ id: '1', name: 'first' })

      let reads = 0
      const tricky = {
        id: '2',
        get name(): string {
          reads += 1
          if (reads > 1) throw new Error('second read fails')
          return 'second'
        },
      } as { id: string; name: string }

      // Implementation may legitimately throw OR succeed by cloning once —
      // both are acceptable. What is NOT acceptable is silent split-brain
      // where baseline and draft disagree (dirty=true with no edits).
      try {
        buf.set(tricky)
      } catch {
        // Acceptable; the state-consistency check below holds regardless.
      }
      expect(buf.dirty.value).toBe(false)
      // Reinforce: the draft must be a valid object — not silently null'd —
      // so a regression that wiped both refs would still trip this check
      // even though dequal(null, null) would satisfy `dirty === false`.
      expect(buf.draft.value).not.toBeNull()
    })

    it('set() failure leaves the previous baseline intact', () => {
      // If deepCopy throws (e.g. cyclic + non-serialisable input on the JSON
      // fallback path), set() must not mutate either ref — the buffer must
      // remain at its previous value.
      const buf = useEditBuffer<{ id: string; tag: string }>({ id: '1', tag: 'before' })
      const prevDraft = buf.draft.value

      type Cyclic = { id: string; fn: () => void; self?: Cyclic }
      const cyclic: Cyclic = { id: 'bad', fn: () => undefined }
      cyclic.self = cyclic

      try {
        buf.set(cyclic as unknown as { id: string; tag: string })
      } catch {
        // Throw is the documented outcome on non-cloneable input.
      }
      expect(buf.draft.value).toEqual(prevDraft)
      expect(buf.dirty.value).toBe(false)
    })
  })
})
