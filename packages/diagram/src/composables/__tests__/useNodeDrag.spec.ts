import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useCanvasDrag } from '../useCanvasDrag'
import { type MoveToPackagePayload, useNodeDrag } from '../useNodeDrag'

beforeEach(() => {
  if (!('elementsFromPoint' in document)) {
    ;(document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => []
  }
})

afterEach(() => {
  useCanvasDrag().end()
  document.body.innerHTML = ''
})

function withCaptureSpies(el: HTMLElement): HTMLElement {
  // happy-dom doesn't implement Pointer Capture API — stub the trio so the
  // composable can call them and so tests can assert against them.
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  // hasPointerCapture starts false; flip to true once setPointerCapture fires.
  let captured = false
  el.hasPointerCapture = vi.fn(() => captured)
  ;(el.setPointerCapture as ReturnType<typeof vi.fn>).mockImplementation(() => {
    captured = true
  })
  ;(el.releasePointerCapture as ReturnType<typeof vi.fn>).mockImplementation(() => {
    captured = false
  })
  return el
}

function makePointerEvent(
  type: string,
  init: {
    clientX: number
    clientY: number
    button?: number
    pointerId?: number
    /**
     * When set, `currentTarget` differs from `target` — modelling the real-world
     * case where the user clicks on an inner element (icon, label) but the
     * pointermove listener is wired on a parent (the header).
     */
    currentTarget?: HTMLElement
  }
): PointerEvent {
  const target = withCaptureSpies(document.createElement('div'))
  const currentTarget = init.currentTarget ?? target
  const e = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX,
    clientY: init.clientY,
  })
  Object.defineProperty(e, 'target', { value: target, configurable: true })
  Object.defineProperty(e, 'currentTarget', { value: currentTarget, configurable: true })
  return e
}

function makeOptions(overrides?: Partial<Parameters<typeof useNodeDrag>[0]>) {
  const el = ref<HTMLElement | null>(withCaptureSpies(document.createElement('div')))
  const onMove = vi.fn()
  const onMoveToPackage = vi.fn()
  return {
    options: {
      kind: 'entity' as const,
      id: () => 'node-1',
      layout: () => ({ x: 100, y: 100 }),
      el,
      parentPackageId: () => undefined as string | undefined,
      zoom: () => 1,
      absolute: () => true,
      onMove,
      onMoveToPackage,
      ...overrides,
    },
    onMove,
    onMoveToPackage,
    el,
  }
}

describe('useNodeDrag', () => {
  it('starts idle (dragging=false, dragMoved=false)', () => {
    const { options } = makeOptions()
    const { dragging, dragMoved } = useNodeDrag(options)
    expect(dragging.value).toBe(false)
    expect(dragMoved.value).toBe(false)
  })

  it('does NOT start dragging on non-left button', () => {
    const { options } = makeOptions()
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0, button: 2 }))
    expect(drag.dragging.value).toBe(false)
  })

  it('does NOT start dragging when not absolute (sub-grid mode)', () => {
    const { options } = makeOptions({ absolute: () => false })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    expect(drag.dragging.value).toBe(false)
  })

  it('captures the pointer on e.currentTarget (the listener element) — not on options.el or e.target', () => {
    // Regression: an earlier attempt captured on `options.el.value` (the node
    // root). The Pointer Events spec retargets all subsequent events to fire
    // AT the captured element; the consumer's `onPointermove={…}` listener is
    // on the header — a CHILD of options.el — so it never sees the events
    // and the drag dies at pointerdown. Capture must stay on the
    // listener-bearing element (`currentTarget`).
    const { options, el } = makeOptions()
    const drag = useNodeDrag(options)
    const header = withCaptureSpies(document.createElement('div'))
    const inner = withCaptureSpies(document.createElement('span'))
    header.appendChild(inner)
    // Simulate: user clicked on `inner` (e.target), but `onPointerdown` is
    // wired on `header` (e.currentTarget).
    const e = makePointerEvent('pointerdown', { clientX: 50, clientY: 50, currentTarget: header })
    Object.defineProperty(e, 'target', { value: inner, configurable: true })
    drag.onPointerDown(e)
    expect(drag.dragging.value).toBe(true)
    expect(header.setPointerCapture).toHaveBeenCalledWith(1)
    expect(el.value!.setPointerCapture).not.toHaveBeenCalled()
    expect(inner.setPointerCapture).not.toHaveBeenCalled()
    expect(useCanvasDrag().draggingId.value).toBe('node-1')
  })

  it('falls back to options.el when e.currentTarget is null', () => {
    // Defensive: if a custom caller wires the handlers without binding a
    // listener (so currentTarget is null), capture on the node root rather
    // than dropping it entirely.
    const { options, el } = makeOptions()
    const drag = useNodeDrag(options)
    const e = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 })
    Object.defineProperty(e, 'currentTarget', { value: null, configurable: true })
    drag.onPointerDown(e)
    expect(el.value!.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('emits onMove with snapped coordinates as the pointer moves', () => {
    const { options, onMove } = makeOptions()
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 50, clientY: 50 }))
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 90, clientY: 50 }))
    expect(onMove).toHaveBeenCalled()
    const [id, x, y] = onMove.mock.calls.at(-1)!
    expect(id).toBe('node-1')
    // x snaps to grid (24px); 100 + 40 = 140 → snap → 144
    expect(x % 24).toBe(0)
    expect(y % 24).toBe(0)
  })

  it('ignores pointer movements before pointerdown', () => {
    const { options, onMove } = makeOptions()
    const drag = useNodeDrag(options)
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 90, clientY: 50 }))
    expect(onMove).not.toHaveBeenCalled()
    expect(drag.dragMoved.value).toBe(false)
  })

  it('only flags dragMoved after the 3px screen-space threshold is crossed', () => {
    const { options } = makeOptions()
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    // 2px move — below threshold
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 2, clientY: 0 }))
    expect(drag.dragMoved.value).toBe(false)
    // 4px move — above threshold
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 4, clientY: 0 }))
    expect(drag.dragMoved.value).toBe(true)
  })

  it('threshold is screen-space — 2px screen movement at zoom=4 is NOT a drag', () => {
    // Regression: an earlier version divided the delta by zoom before
    // comparing to 3, so at zoom=4 a 12-world-px screen move (0.75 world)
    // would slip under the threshold but a 2-screen-px move (0.5 world)
    // would also incorrectly be classified as a drag at zoom>1. Now
    // screen-space is authoritative.
    const { options } = makeOptions({ zoom: () => 4 })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 2, clientY: 0 }))
    expect(drag.dragMoved.value).toBe(false)
  })

  it('divides pointer delta by zoom so dragging tracks the cursor', () => {
    const { options, onMove } = makeOptions({ zoom: () => 2 })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 48, clientY: 0 }))
    // 48px screen movement at zoom=2 -> 24px world movement; snaps to 24, so x=124 -> rounds to 120
    const [, x] = onMove.mock.calls.at(-1)!
    expect(x).toBe(120)
  })

  it('emits onMoveToPackage when released over a different package', () => {
    const { options, onMoveToPackage } = makeOptions({
      parentPackageId: () => 'pkg-A',
    })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    // Simulate a drop-target candidate being chosen by hit-testing.
    useCanvasDrag().setDropTarget('pkg-B')
    drag.onPointerUp(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }))
    expect(onMoveToPackage).toHaveBeenCalledOnce()
    const payload: MoveToPackagePayload<'entity'> = onMoveToPackage.mock.calls[0][0]
    expect(payload).toEqual({ type: 'entity', id: 'node-1', targetPackageId: 'pkg-B' })
  })

  it('does NOT emit onMoveToPackage when node has no parent package', () => {
    const { options, onMoveToPackage } = makeOptions({
      parentPackageId: () => undefined,
    })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    useCanvasDrag().setDropTarget('pkg-B')
    drag.onPointerUp(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }))
    expect(onMoveToPackage).not.toHaveBeenCalled()
  })

  it('does NOT emit onMoveToPackage when no drop target was chosen', () => {
    const { options, onMoveToPackage } = makeOptions({
      parentPackageId: () => 'pkg-A',
    })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    drag.onPointerUp(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }))
    expect(onMoveToPackage).not.toHaveBeenCalled()
  })

  it('releases the pointer on the same element it was captured on (pointerup)', () => {
    const { options } = makeOptions()
    const drag = useNodeDrag(options)
    // Single header element drives both events — pointer capture and release
    // happen on this one node.
    const header = withCaptureSpies(document.createElement('div'))
    drag.onPointerDown(
      makePointerEvent('pointerdown', { clientX: 0, clientY: 0, currentTarget: header })
    )
    drag.onPointerUp(
      makePointerEvent('pointerup', { clientX: 5, clientY: 5, currentTarget: header })
    )
    expect(drag.dragging.value).toBe(false)
    expect(header.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(useCanvasDrag().draggingId.value).toBeNull()
  })

  it('pointerup before pointerdown is a no-op (no release call)', () => {
    const { options, onMoveToPackage } = makeOptions()
    const drag = useNodeDrag(options)
    const header = withCaptureSpies(document.createElement('div'))
    drag.onPointerUp(
      makePointerEvent('pointerup', { clientX: 5, clientY: 5, currentTarget: header })
    )
    expect(header.releasePointerCapture).not.toHaveBeenCalled()
    expect(onMoveToPackage).not.toHaveBeenCalled()
  })

  it('exposes the right kind in the onMoveToPackage payload', () => {
    const { options, onMoveToPackage } = makeOptions({
      kind: 'package' as const,
      parentPackageId: () => 'pkg-outer',
    })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    useCanvasDrag().setDropTarget('pkg-other')
    drag.onPointerUp(makePointerEvent('pointerup', { clientX: 5, clientY: 5 }))
    expect(onMoveToPackage.mock.calls[0][0].type).toBe('package')
  })

  it('clamps onMove output to non-negative coordinates', () => {
    const { options, onMove } = makeOptions({ layout: () => ({ x: 5, y: 5 }) })
    const drag = useNodeDrag(options)
    drag.onPointerDown(makePointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
    drag.onPointerMove(makePointerEvent('pointermove', { clientX: 0, clientY: 0 }))
    const [, x, y] = onMove.mock.calls.at(-1)!
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
  })

  describe('pointercancel', () => {
    it('restores idle state without emitting onMoveToPackage', () => {
      const { options, onMoveToPackage } = makeOptions({
        parentPackageId: () => 'pkg-A',
      })
      const drag = useNodeDrag(options)
      const header = withCaptureSpies(document.createElement('div'))
      drag.onPointerDown(
        makePointerEvent('pointerdown', { clientX: 0, clientY: 0, currentTarget: header })
      )
      useCanvasDrag().setDropTarget('pkg-B')
      drag.onPointerCancel(
        makePointerEvent('pointercancel', { clientX: 5, clientY: 5, currentTarget: header })
      )
      expect(drag.dragging.value).toBe(false)
      expect(onMoveToPackage).not.toHaveBeenCalled()
      expect(useCanvasDrag().draggingId.value).toBeNull()
      expect(header.releasePointerCapture).toHaveBeenCalledWith(1)
    })

    it('is a no-op when not currently dragging', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      const header = withCaptureSpies(document.createElement('div'))
      drag.onPointerCancel(
        makePointerEvent('pointercancel', { clientX: 5, clientY: 5, currentTarget: header })
      )
      expect(header.releasePointerCapture).not.toHaveBeenCalled()
    })
  })

  describe('pointer capture survives release-time exceptions', () => {
    it('endDrag() does not throw when releasePointerCapture itself throws', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      const header = withCaptureSpies(document.createElement('div'))
      drag.onPointerDown(
        makePointerEvent('pointerdown', { clientX: 0, clientY: 0, currentTarget: header })
      )
      // Simulate the OS having reclaimed the capture (rare, but happens
      // during gesture cancel races): hasPointerCapture is false and
      // releasePointerCapture throws if called anyway.
      ;(header.hasPointerCapture as ReturnType<typeof vi.fn>).mockReturnValue(false)
      ;(header.releasePointerCapture as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('element detached')
      })
      expect(() =>
        drag.onPointerUp(
          makePointerEvent('pointerup', { clientX: 5, clientY: 5, currentTarget: header })
        )
      ).not.toThrow()
      expect(drag.dragging.value).toBe(false)
    })
  })

  /**
   * AGENTS.md §18 — keyboard parity for drag-and-drop. The keyboard
   * contract is independent of the pointer state machine: Space picks up,
   * arrow keys nudge by GRID_SIZE, Space/Enter commits, Escape reverts.
   * Reverting must call onMove back to the pre-pickup position.
   */
  describe('keyboard contract (AGENTS.md §18)', () => {
    function makeKeyEvent(key: string): KeyboardEvent {
      return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    }

    it('starts not picked-up', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      expect(drag.pickedUp.value).toBe(false)
    })

    it('Space picks up; second Space commits at current position', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      drag.onKeyDown(makeKeyEvent(' '))
      expect(drag.pickedUp.value).toBe(true)
      drag.onKeyDown(makeKeyEvent(' '))
      expect(drag.pickedUp.value).toBe(false)
    })

    it('Enter commits when picked up; ignored when not', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      drag.onKeyDown(makeKeyEvent('Enter'))
      expect(drag.pickedUp.value).toBe(false)
      drag.onKeyDown(makeKeyEvent(' '))
      drag.onKeyDown(makeKeyEvent('Enter'))
      expect(drag.pickedUp.value).toBe(false)
    })

    it('Arrow keys nudge by GRID_SIZE only while picked up', () => {
      // Start grid-aligned (24 * 5 = 120) so snap is a no-op on idle axes
      // and the right-direction assertion is unambiguous.
      const layout = ref({ x: 120, y: 120 })
      const { options, onMove } = makeOptions({ layout: () => layout.value })
      const drag = useNodeDrag(options)

      // Not picked up — arrows do nothing.
      drag.onKeyDown(makeKeyEvent('ArrowRight'))
      expect(onMove).not.toHaveBeenCalled()

      drag.onKeyDown(makeKeyEvent(' '))
      drag.onKeyDown(makeKeyEvent('ArrowRight'))
      expect(onMove).toHaveBeenCalledExactlyOnceWith('node-1', 144, 120)

      drag.onKeyDown(makeKeyEvent('ArrowDown'))
      expect(onMove).toHaveBeenLastCalledWith('node-1', 120, 144)
    })

    it('Escape reverts to pre-pickup position via onMove and drops', () => {
      const layout = ref({ x: 100, y: 100 })
      const { options, onMove } = makeOptions({ layout: () => layout.value })
      const drag = useNodeDrag(options)
      drag.onKeyDown(makeKeyEvent(' '))
      // simulate a couple of nudges shifting the live layout
      drag.onKeyDown(makeKeyEvent('ArrowRight'))
      layout.value = { x: 120, y: 100 }
      drag.onKeyDown(makeKeyEvent('ArrowDown'))
      layout.value = { x: 120, y: 120 }
      onMove.mockClear()

      drag.onKeyDown(makeKeyEvent('Escape'))
      // Revert calls onMove with the original pickup position {100, 100}.
      expect(onMove).toHaveBeenCalledWith('node-1', 100, 100)
      expect(drag.pickedUp.value).toBe(false)
    })

    it('ignores all keys when absolute() is false', () => {
      const { options, onMove } = makeOptions({ absolute: () => false })
      const drag = useNodeDrag(options)
      drag.onKeyDown(makeKeyEvent(' '))
      drag.onKeyDown(makeKeyEvent('ArrowRight'))
      expect(drag.pickedUp.value).toBe(false)
      expect(onMove).not.toHaveBeenCalled()
    })

    it('ignores all keys when enabled() returns false', () => {
      const { options, onMove } = makeOptions({ enabled: () => false })
      const drag = useNodeDrag(options)
      drag.onKeyDown(makeKeyEvent(' '))
      expect(drag.pickedUp.value).toBe(false)
      drag.onKeyDown(makeKeyEvent('ArrowRight'))
      expect(onMove).not.toHaveBeenCalled()
    })

    it('passes non-handled keys through (no preventDefault on Tab, letters)', () => {
      const { options } = makeOptions()
      const drag = useNodeDrag(options)
      const tab = makeKeyEvent('Tab')
      drag.onKeyDown(tab)
      expect(tab.defaultPrevented).toBe(false)
    })
  })
})
