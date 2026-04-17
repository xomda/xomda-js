import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { resetScrollOnPathChange } from '../scroll-reset'

/**
 * `watch` registers an effect onto the active effect scope. Each
 * test runs inside a fresh scope that's torn down afterwards, so
 * watchers don't leak between cases.
 */
let scope: ReturnType<typeof effectScope>

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('resetScrollOnPathChange', () => {
  it('resets scrollTop to 0 when the path changes', async () => {
    const path = ref('docs/a.md')
    const el = { scrollTop: 320 }

    scope.run(() => {
      resetScrollOnPathChange(
        () => path.value,
        () => el
      )
    })

    path.value = 'docs/b.md'
    await nextTick()
    expect(el.scrollTop).toBe(0)
  })

  it('leaves scrollTop alone when only non-path inputs change', async () => {
    // The host can re-emit the same file with a refreshed `text` (file
    // saved, view-data reloaded). That must not yank the reader back
    // to the top — only navigation to a different file should.
    const path = ref('docs/a.md')
    const text = ref('hello')
    const el = { scrollTop: 250 }

    scope.run(() => {
      resetScrollOnPathChange(
        () => path.value,
        () => el
      )
    })

    text.value = 'hello world'
    await nextTick()
    expect(el.scrollTop).toBe(250)
  })

  it('does not throw when the scroll element is not yet mounted', async () => {
    const path = ref('docs/a.md')
    const elRef: { current: { scrollTop: number } | null } = { current: null }

    scope.run(() => {
      resetScrollOnPathChange(
        () => path.value,
        () => elRef.current
      )
    })

    expect(() => {
      path.value = 'docs/b.md'
    }).not.toThrow()
    await nextTick()

    // Late mount: once the element exists, the next navigation still
    // resets it.
    elRef.current = { scrollTop: 80 }
    path.value = 'docs/c.md'
    await nextTick()
    expect(elRef.current.scrollTop).toBe(0)
  })
})
