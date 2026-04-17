import { inject, type InjectionKey, type Ref, ref } from 'vue'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1
export const ZOOM_SLIDER_STEP = 0.05

/**
 * Inject key for the persistent zoom ref. The host app (e.g. @xomda/client)
 * provides a ref backed by its preferences store; standalone consumers
 * (Storybook, tests) get the in-memory fallback ref below.
 *
 * The diagram package deliberately does not depend on @xomda/ui or Pinia —
 * persistence is the consumer's concern. This keeps the diagram bundle
 * lean and avoids the "two writers racing on the same localStorage key"
 * class of bug.
 */
export const CANVAS_ZOOM_KEY: InjectionKey<Ref<number>> = Symbol('xomda.canvasZoom')

const fallbackZoom: Ref<number> = ref(1)

const clampZoom = (n: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n))

export function useCanvasZoom() {
  const zoom = inject(CANVAS_ZOOM_KEY, fallbackZoom)

  function setZoom(value: number) {
    zoom.value = clampZoom(Math.round(value * 100) / 100)
  }
  function zoomIn() {
    setZoom(zoom.value + ZOOM_STEP)
  }
  function zoomOut() {
    setZoom(zoom.value - ZOOM_STEP)
  }
  function reset() {
    setZoom(1)
  }
  return { zoom, setZoom, zoomIn, zoomOut, reset }
}
