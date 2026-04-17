import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type App, createApp, defineComponent, provide, ref } from 'vue'

import { CANVAS_ZOOM_KEY, useCanvasZoom, ZOOM_MAX, ZOOM_MIN } from '../useCanvasZoom'

/**
 * The diagram zoom-in / zoom-out contract is "snap to the next 10% multiple
 * in the direction of motion" — documented in useCanvasZoom.ts and relied on
 * by `model/layout-and-zoom.cy.ts`. Without this spec the snap-vs-fixed-step
 * choice could drift silently (it has — the Cypress test once expected
 * `85% + step → 95%` even though the code snapped to 90%).
 *
 * `useCanvasZoom` calls Vue's `inject()` which only resolves inside a real
 * component setup. We mount a throw-away component that captures the
 * composable's return value, then drive every assertion through it.
 */

function mountWithZoom() {
  let api: ReturnType<typeof useCanvasZoom> | null = null
  const Host = defineComponent({
    setup() {
      provide(CANVAS_ZOOM_KEY, ref(1))
      api = useCanvasZoom()
      return () => null
    },
  })
  const container = document.createElement('div')
  const app = createApp(Host)
  app.mount(container)
  if (!api) throw new Error('useCanvasZoom did not resolve')
  return { api, app }
}

describe('useCanvasZoom', () => {
  let zoomApi: ReturnType<typeof useCanvasZoom>
  let app: App
  beforeEach(() => {
    const m = mountWithZoom()
    zoomApi = m.api
    app = m.app
    zoomApi.reset()
  })
  afterEach(() => {
    app.unmount()
  })

  describe('setZoom', () => {
    it('rounds to two decimals to avoid float drift', () => {
      zoomApi.setZoom(0.857)
      expect(zoomApi.zoom.value).toBe(0.86)
    })

    it('clamps to ZOOM_MIN/ZOOM_MAX', () => {
      zoomApi.setZoom(10)
      expect(zoomApi.zoom.value).toBe(ZOOM_MAX)
      zoomApi.setZoom(0.001)
      expect(zoomApi.zoom.value).toBe(ZOOM_MIN)
    })
  })

  describe('zoomIn — snap to next 10% in the up direction', () => {
    it.each([
      [0.85, 0.9], // off-grid: snaps to the next 10% mark (85 → 90, not 95)
      [0.9, 1.0], // on-grid: moves a full step (90 → 100)
      [1.27, 1.3], // off-grid above 100: 127 → 130
      [1.0, 1.1], // on-grid 100: moves to 110
    ])('from %f goes to %f', (start, expected) => {
      zoomApi.setZoom(start)
      zoomApi.zoomIn()
      expect(zoomApi.zoom.value).toBe(expected)
    })

    it('does not exceed ZOOM_MAX', () => {
      zoomApi.setZoom(ZOOM_MAX)
      zoomApi.zoomIn()
      expect(zoomApi.zoom.value).toBe(ZOOM_MAX)
    })
  })

  describe('zoomOut — snap to previous 10% in the down direction', () => {
    it.each([
      [0.85, 0.8], // off-grid: snaps to the previous 10% mark (85 → 80)
      [0.9, 0.8], // on-grid: moves a full step (90 → 80)
      [1.27, 1.2], // off-grid above 100: 127 → 120
      [1.0, 0.9], // on-grid 100: moves to 90
    ])('from %f goes to %f', (start, expected) => {
      zoomApi.setZoom(start)
      zoomApi.zoomOut()
      expect(zoomApi.zoom.value).toBe(expected)
    })

    it('does not fall below ZOOM_MIN', () => {
      zoomApi.setZoom(ZOOM_MIN)
      zoomApi.zoomOut()
      expect(zoomApi.zoom.value).toBe(ZOOM_MIN)
    })
  })

  describe('reset', () => {
    it('returns to 1.0 from any starting value', () => {
      zoomApi.setZoom(0.45)
      zoomApi.reset()
      expect(zoomApi.zoom.value).toBe(1)
    })
  })
})
