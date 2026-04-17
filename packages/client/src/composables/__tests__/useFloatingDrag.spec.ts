import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useFloatingDrag } from '../useFloatingDrag'

// `currentTarget` is a getter on the real Event interface, so we build a
// plain object that satisfies the shape the composable reads.
const makePointerEvent = (init: Partial<PointerEvent> = {}): PointerEvent => {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    currentTarget: {
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => true,
    } as unknown as HTMLElement,
    ...init,
  } as unknown as PointerEvent
}

describe('useFloatingDrag', () => {
  it('offset starts at zero', () => {
    const { offset, dragging } = useFloatingDrag()
    expect(offset.value).toEqual({ dx: 0, dy: 0 })
    expect(dragging.value).toBe(false)
  })

  it('pointer-down → move updates offset by the pointer delta', () => {
    const drag = useFloatingDrag()
    drag.onPointerDown(makePointerEvent({ clientX: 100, clientY: 100 }))
    expect(drag.dragging.value).toBe(true)
    drag.onPointerMove(makePointerEvent({ clientX: 130, clientY: 120 }))
    expect(drag.offset.value).toEqual({ dx: 30, dy: 20 })
  })

  it('subsequent drags accumulate on top of the prior offset', () => {
    const drag = useFloatingDrag()
    drag.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }))
    drag.onPointerMove(makePointerEvent({ clientX: 10, clientY: 5 }))
    drag.onPointerUp(makePointerEvent())
    expect(drag.dragging.value).toBe(false)
    // New drag starts from the previous offset.
    drag.onPointerDown(makePointerEvent({ clientX: 50, clientY: 50 }))
    drag.onPointerMove(makePointerEvent({ clientX: 60, clientY: 70 }))
    expect(drag.offset.value).toEqual({ dx: 20, dy: 25 })
  })

  it('ignores non-primary buttons (so right/middle click doesn’t hijack the drag)', () => {
    const drag = useFloatingDrag()
    drag.onPointerDown(makePointerEvent({ button: 2, clientX: 100, clientY: 100 }))
    expect(drag.dragging.value).toBe(false)
    // A subsequent move should be a no-op.
    drag.onPointerMove(makePointerEvent({ clientX: 200, clientY: 200 }))
    expect(drag.offset.value).toEqual({ dx: 0, dy: 0 })
  })

  it('resets offset when anchorKey changes (new selection / new home)', async () => {
    const anchor = ref<unknown>({ top: 0, left: 0 })
    const drag = useFloatingDrag(() => anchor.value)
    drag.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }))
    drag.onPointerMove(makePointerEvent({ clientX: 40, clientY: 40 }))
    drag.onPointerUp(makePointerEvent())
    expect(drag.offset.value).toEqual({ dx: 40, dy: 40 })
    anchor.value = { top: 100, left: 100 }
    await Promise.resolve()
    await Promise.resolve()
    expect(drag.offset.value).toEqual({ dx: 0, dy: 0 })
  })

  it('pointer-up while not dragging is a no-op (no thrown errors)', () => {
    const drag = useFloatingDrag()
    expect(() => drag.onPointerUp(makePointerEvent())).not.toThrow()
    expect(drag.dragging.value).toBe(false)
  })
})
