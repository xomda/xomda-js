import { useStorage } from '@vueuse/core'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1
export const ZOOM_SLIDER_STEP = 0.05
export const ZOOM_STORAGE_KEY = 'xomda-diagram-zoom'

const zoom = useStorage<number>(ZOOM_STORAGE_KEY, 1, undefined, {
  serializer: {
    read: (raw) => {
      const n = Number(raw)
      if (!Number.isFinite(n)) return 1
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n))
    },
    write: (value) => String(value),
  },
})

export function useCanvasZoom() {
  function setZoom(value: number) {
    zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
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
