import { ref } from 'vue'

export function usePanelResize(initialWidth: number, min: number, max: number) {
  const width = ref(initialWidth)

  function onResize(delta: number) {
    width.value = Math.max(min, Math.min(max, width.value + delta))
  }

  return { width, onResize }
}
