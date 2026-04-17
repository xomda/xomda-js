import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { nextTick, provide, ref } from 'vue'

import {
  CANVAS_GRID_SNAP_KEY,
  CANVAS_PAN_X_KEY,
  CANVAS_PAN_Y_KEY,
  CANVAS_ZOOM_KEY,
  GRID_SIZE,
} from '../../../composables'
import { DiagramCanvas } from '../DiagramCanvas'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

function dispatchWheel(el: Element, init: WheelEventInit) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })
  // happy-dom's WheelEvent constructor ignores `ctrlKey`/`metaKey` from
  // the init dict; pin them onto the instance so the handler sees them.
  if (init.ctrlKey) Object.defineProperty(event, 'ctrlKey', { value: true })
  if (init.metaKey) Object.defineProperty(event, 'metaKey', { value: true })
  el.dispatchEvent(event)
}

function mountWithProvides(zoom = ref(1), panX = ref(0), panY = ref(0), gridSnap = ref(false)) {
  const Host = {
    setup() {
      provide(CANVAS_ZOOM_KEY, zoom)
      provide(CANVAS_PAN_X_KEY, panX)
      provide(CANVAS_PAN_Y_KEY, panY)
      provide(CANVAS_GRID_SNAP_KEY, gridSnap)
      return () => <DiagramCanvas />
    },
  }
  const wrapper = mount(Host, { attachTo: document.body })
  const viewport = wrapper.find('[class*="viewport"]').element as HTMLElement
  // happy-dom returns a zero rect; stub a deterministic one so the
  // cursor-anchor math has something to bite on.
  viewport.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  return { wrapper, viewport, zoom, panX, panY, gridSnap }
}

describe('DiagramCanvas wheel handling', () => {
  it('pans the scene on plain wheel', () => {
    const { viewport, panX, panY } = mountWithProvides()
    dispatchWheel(viewport, { deltaX: 30, deltaY: 40 })
    expect(panX.value).toBe(-30)
    expect(panY.value).toBe(-40)
  })

  it('zooms in on Ctrl+wheel up', () => {
    const zoom = ref(1)
    const { viewport } = mountWithProvides(zoom)
    dispatchWheel(viewport, { deltaY: -100, ctrlKey: true, clientX: 400, clientY: 300 })
    expect(zoom.value).toBeGreaterThan(1)
  })

  it('zooms out on Cmd+wheel down', () => {
    const zoom = ref(1)
    const { viewport } = mountWithProvides(zoom)
    dispatchWheel(viewport, { deltaY: 100, metaKey: true, clientX: 400, clientY: 300 })
    expect(zoom.value).toBeLessThan(1)
  })
})

describe('DiagramCanvas grid-snap pan', () => {
  function innerStyles(wrapper: ReturnType<typeof mount>) {
    const inner = wrapper.find('[class*="inner"]').element as HTMLElement
    return {
      transform: inner.style.transform,
    }
  }
  function viewportStyles(viewport: HTMLElement) {
    return { backgroundPosition: viewport.style.backgroundPosition }
  }

  it('renders raw pan when grid-snap is off', async () => {
    // 7px is sub-cell at zoom 1 (cell = GRID_SIZE = 24px). Without
    // snapping the rendered transform tracks the raw value exactly.
    const panX = ref(7)
    const panY = ref(5)
    const { wrapper, viewport } = mountWithProvides(ref(1), panX, panY, ref(false))
    expect(innerStyles(wrapper).transform).toContain('translate(7px, 5px)')
    expect(viewportStyles(viewport).backgroundPosition).toBe('7px 5px')
  })

  it('snaps rendered pan to grid steps when on', async () => {
    // Stored pan is sub-cell, but the rendered transform/background
    // round to the nearest whole grid cell so the camera reads as
    // stepped. cellPx at zoom 1 = GRID_SIZE = 24.
    const panX = ref(7) // < cell/2 → snaps to 0
    const panY = ref(20) // > cell/2 → snaps to 24
    const { wrapper, viewport } = mountWithProvides(ref(1), panX, panY, ref(true))
    expect(innerStyles(wrapper).transform).toContain(`translate(0px, ${GRID_SIZE}px)`)
    expect(viewportStyles(viewport).backgroundPosition).toBe(`0px ${GRID_SIZE}px`)
  })

  it('keeps the raw accumulator continuous while snapping', async () => {
    // Wheel emits sub-cell deltas; the stored panX/panY still
    // accumulate continuously so eventually the half-cell threshold is
    // crossed and the rendered pan jumps. Toggling snap off resumes
    // smooth panning from the un-lost offset.
    const panX = ref(0)
    const panY = ref(0)
    const gridSnap = ref(true)
    const { viewport, wrapper } = mountWithProvides(ref(1), panX, panY, gridSnap)
    dispatchWheel(viewport, { deltaX: 7, deltaY: 0 })
    // Raw moved (wheel deltas are inverted into pan).
    expect(panX.value).toBe(-7)
    await nextTick()
    // But rendered transform still snaps to 0 (|-7| < cell/2 = 12).
    expect(innerStyles(wrapper).transform).toContain('translate(0px, 0px)')
    dispatchWheel(viewport, { deltaX: 7, deltaY: 0 })
    expect(panX.value).toBe(-14)
    await nextTick()
    // -14 rounds to -24 (cell) — the camera jumps one grid step.
    expect(innerStyles(wrapper).transform).toContain(`translate(-${GRID_SIZE}px, 0px)`)
  })

  it('commits the snapped position when grid-snap turns off (no jump)', async () => {
    // While snap is on the raw accumulator drifts past the rendered
    // (snapped) position. Toggling off must not surface that drift —
    // the visible camera should stay where the user saw it.
    const panX = ref(7) // rendered as 0 with snap on
    const panY = ref(20) // rendered as 24 with snap on
    const gridSnap = ref(true)
    const { wrapper } = mountWithProvides(ref(1), panX, panY, gridSnap)
    await nextTick()
    expect(innerStyles(wrapper).transform).toContain(`translate(0px, ${GRID_SIZE}px)`)
    gridSnap.value = false
    await nextTick()
    // Raw refs now match the snapped position; rendered pan is
    // unchanged so there is no visual jump.
    expect(panX.value).toBe(0)
    expect(panY.value).toBe(GRID_SIZE)
    expect(innerStyles(wrapper).transform).toContain(`translate(0px, ${GRID_SIZE}px)`)
  })
})
