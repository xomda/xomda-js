import { type Ref, ref, watch } from 'vue'

import type { Layout, LayoutEntry } from '../types'

const GRID_SIZE = 24

export function snap(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid
}

export function useCanvasLayout(initialLayout: Ref<Layout>) {
  const layout = ref<Layout>({ ...initialLayout.value })

  watch(initialLayout, (val) => {
    layout.value = { ...val }
  })

  function get(id: string): LayoutEntry {
    return layout.value[id] ?? { x: 0, y: 0 }
  }

  function setPosition(id: string, x: number, y: number): void {
    const existing = layout.value[id] ?? {}
    layout.value = { ...layout.value, [id]: { ...existing, x: snap(Math.max(0, x)), y: snap(Math.max(0, y)) } }
  }

  function setSize(id: string, width: number, height: number): void {
    const existing = layout.value[id] ?? { x: 0, y: 0 }
    layout.value = {
      ...layout.value,
      [id]: { ...existing, width: snap(Math.max(GRID_SIZE * 4, width)), height: snap(Math.max(GRID_SIZE * 4, height)) },
    }
  }

  return { layout, get, setPosition, setSize }
}

export type UseCanvasLayoutReturn = ReturnType<typeof useCanvasLayout>
