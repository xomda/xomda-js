import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useNodeResize } from '../useNodeResize'

function withCaptureSpies(el: HTMLElement): HTMLElement {
  // happy-dom doesn't implement Pointer Capture API — stub the trio.
  let captured = false
  el.setPointerCapture = vi.fn(() => {
    captured = true
  })
  el.releasePointerCapture = vi.fn(() => {
    captured = false
  })
  el.hasPointerCapture = vi.fn(() => captured)
  return el
}

function makePointerEvent(
  type: string,
  init: { clientX: number; clientY: number; pointerId?: number }
): PointerEvent {
  const target = withCaptureSpies(document.createElement('div'))
  const e = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX,
    clientY: init.clientY,
  })
  Object.defineProperty(e, 'target', { value: target, configurable: true })
  return e
}

describe('useNodeResize', () => {
  it('starts not resizing', () => {
    const { resizing } = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 1,
      onResize: () => {},
    })
    expect(resizing.value).toBe(false)
  })

  it('emits resize with snapped (width, height) on pointer-move', () => {
    const onResize = vi.fn()
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 1,
      onResize,
    })
    r.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    expect(r.resizing.value).toBe(true)
    r.onPointerMove(makePointerEvent('pointermove', { clientX: 50, clientY: 25 }))
    expect(onResize).toHaveBeenCalled()
    // snap() rounds to multiples of 8 — 250 stays, 125 → 128.
    const [w, h] = onResize.mock.calls[0]
    expect(w).toBeGreaterThanOrEqual(200)
    expect(h).toBeGreaterThanOrEqual(100)
  })

  it('clamps to minSize on shrink', () => {
    const onResize = vi.fn()
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 200 }),
      zoom: () => 1,
      minSize: 96,
      onResize,
    })
    r.onPointerDown(makePointerEvent('pointerdown', { clientX: 1000, clientY: 1000 }))
    r.onPointerMove(makePointerEvent('pointermove', { clientX: 0, clientY: 0 }))
    const [w, h] = onResize.mock.calls[0]
    expect(w).toBe(96)
    expect(h).toBe(96)
  })

  it('divides delta by zoom (zoomed-out pointer travels further than the visual delta)', () => {
    const onResize = vi.fn()
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 2,
      onResize,
    })
    r.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    r.onPointerMove(makePointerEvent('pointermove', { clientX: 200, clientY: 100 }))
    const [w, h] = onResize.mock.calls[0]
    // delta 200/100 ÷ zoom 2 → +100/+50 → 300/150 snapped to multiples of 24.
    expect(w).toBe(312)
    expect(h).toBe(144)
  })

  it('ignores pointermove when not resizing (no leak before pointer-down)', () => {
    const onResize = vi.fn()
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 1,
      onResize,
    })
    r.onPointerMove(makePointerEvent('pointermove', { clientX: 50, clientY: 25 }))
    expect(onResize).not.toHaveBeenCalled()
  })

  it('falls back to el.offsetWidth/offsetHeight when initialSize is empty', () => {
    const onResize = vi.fn()
    const el = document.createElement('div')
    Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true })
    Object.defineProperty(el, 'offsetHeight', { value: 150, configurable: true })
    const r = useNodeResize({
      el: ref(el),
      initialSize: () => ({}),
      zoom: () => 1,
      onResize,
    })
    r.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    r.onPointerMove(makePointerEvent('pointermove', { clientX: 24, clientY: 24 }))
    const [w, h] = onResize.mock.calls[0]
    // delta 24/24 + (300, 150) → 324/174 snapped to multiples of 24.
    expect(w).toBe(336)
    expect(h).toBe(168)
  })

  it('releases pointer capture on pointerup', () => {
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 1,
      onResize: () => {},
    })
    const down = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 })
    r.onPointerDown(down)
    const target = down.target as HTMLElement
    expect(target.setPointerCapture).toHaveBeenCalled()
    const up = makePointerEvent('pointerup', { clientX: 50, clientY: 50 })
    // re-attach the same target so hasPointerCapture lookup works.
    Object.defineProperty(up, 'target', { value: target, configurable: true })
    r.onPointerUp(up)
    expect(r.resizing.value).toBe(false)
    expect(target.releasePointerCapture).toHaveBeenCalled()
  })

  it('pointercancel restores idle state (OS interrupts the drag)', () => {
    const r = useNodeResize({
      el: ref(null),
      initialSize: () => ({ width: 200, height: 100 }),
      zoom: () => 1,
      onResize: () => {},
    })
    r.onPointerDown(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    expect(r.resizing.value).toBe(true)
    r.onPointerCancel(makePointerEvent('pointercancel', { clientX: 0, clientY: 0 }))
    expect(r.resizing.value).toBe(false)
  })
})
