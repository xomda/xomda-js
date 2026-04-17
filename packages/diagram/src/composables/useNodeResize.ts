import { type Ref, ref } from 'vue'

import { snap } from './useCanvasLayout'

export interface UseNodeResizeOptions {
  /**
   * The DOM element being resized. On pointer-down its `offsetWidth` /
   * `offsetHeight` fall back if `initialSize()` returns `undefined`
   * dimensions — i.e. on the first resize the layout has no explicit size.
   */
  el: Ref<HTMLElement | null>
  /** Reactive accessor for the current layout dimensions. */
  initialSize: () => { width?: number; height?: number }
  /** Current zoom level (delta is divided by this so the corner stays under the cursor). */
  zoom: () => number
  /** Minimum width and height in CSS pixels (pre-zoom). Default 96. */
  minSize?: number
  /** Fires on every pointer-move with the snapped new dimensions. */
  onResize: (width: number, height: number) => void
}

export interface UseNodeResizeReturn {
  /** True from pointer-down through pointer-up/cancel. Drives the "currently resizing" visual. */
  resizing: Ref<boolean>
  /** Attach to the resize handle's `onPointerdown`. */
  onPointerDown: (e: PointerEvent) => void
  /** Attach to `onPointermove`. */
  onPointerMove: (e: PointerEvent) => void
  /** Attach to `onPointerup`. */
  onPointerUp: (e: PointerEvent) => void
  /** Attach to `onPointercancel`. Restores idle state when the OS interrupts the drag. */
  onPointerCancel: (e: PointerEvent) => void
}

/**
 * Pointer-drag-to-resize for a diagram node. Sibling of `useNodeDrag`;
 * extracted from `<Package>` so the resize handle and future resize
 * surfaces (entity, enum) share one contract instead of re-implementing
 * the pointer state machine.
 *
 * Captures the pointer on `pointerdown` so the resize tracks the cursor
 * even if it leaves the handle's bounds. Snaps dimensions to the grid
 * via `snap()` for consistency with the move-to-reposition flow.
 *
 * Keyboard equivalence (Space-to-grab, arrow-to-resize, Esc-to-cancel)
 * is a known gap shared with `useNodeDrag` — tracked in docs/todo.md.
 */
export function useNodeResize(options: UseNodeResizeOptions): UseNodeResizeReturn {
  const minSize = options.minSize ?? 96
  const resizing = ref(false)
  const startPointer = { x: 0, y: 0 }
  const startSize = { width: 0, height: 0 }

  function onPointerDown(e: PointerEvent): void {
    e.preventDefault()
    e.stopPropagation()
    resizing.value = true
    startPointer.x = e.clientX
    startPointer.y = e.clientY
    const layout = options.initialSize()
    startSize.width = layout.width ?? options.el.value?.offsetWidth ?? minSize
    startSize.height = layout.height ?? options.el.value?.offsetHeight ?? minSize
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!resizing.value) return
    const z = options.zoom() || 1
    const dx = (e.clientX - startPointer.x) / z
    const dy = (e.clientY - startPointer.y) / z
    const newW = snap(Math.max(minSize, startSize.width + dx))
    const newH = snap(Math.max(minSize, startSize.height + dy))
    options.onResize(newW, newH)
  }

  function endResize(e: PointerEvent): void {
    if (!resizing.value) return
    resizing.value = false
    const target = e.target as HTMLElement | null
    if (target && target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId)
    }
  }

  return {
    resizing,
    onPointerDown,
    onPointerMove,
    onPointerUp: endResize,
    onPointerCancel: endResize,
  }
}
