import { type Ref, ref, watch } from 'vue'

export interface UseFloatingDragReturn {
  /** Active drag offset (in screen pixels) applied on top of the base anchor. */
  offset: Ref<{ dx: number; dy: number }>
  /** True between pointer-down and pointer-up. */
  dragging: Ref<boolean>
  /** Wire to the drag-handle element's `onPointerdown`. */
  onPointerDown: (e: PointerEvent) => void
  /** Wire to `onPointermove`. */
  onPointerMove: (e: PointerEvent) => void
  /** Wire to `onPointerup` and `onPointercancel`. */
  onPointerUp: (e: PointerEvent) => void
}

/**
 * Lightweight pointer-drag composable for floating UI chrome (toolbars,
 * pills) that have an upstream anchor but want a manual nudge.
 *
 * Returns an additive `offset` that the consumer applies to its anchor
 * (`top + offset.dy`, `left + offset.dx`). The offset resets to zero
 * whenever `anchorKey` changes — typically when the upstream anchor
 * jumps to a new target (e.g. the user selects a different node), so
 * the toolbar drops back onto its computed home.
 *
 * Pointer capture is taken on the handle element, so the drag tracks
 * even when the cursor leaves the handle's bounds.
 */
export function useFloatingDrag(anchorKey?: () => unknown): UseFloatingDragReturn {
  const offset = ref({ dx: 0, dy: 0 })
  const dragging = ref(false)
  let start = { px: 0, py: 0, dx: 0, dy: 0 }

  if (anchorKey) {
    watch(anchorKey, () => {
      offset.value = { dx: 0, dy: 0 }
    })
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragging.value = true
    start = {
      px: e.clientX,
      py: e.clientY,
      dx: offset.value.dx,
      dy: offset.value.dy,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return
    offset.value = {
      dx: start.dx + (e.clientX - start.px),
      dy: start.dy + (e.clientY - start.py),
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging.value) return
    dragging.value = false
    const target = e.currentTarget as HTMLElement | null
    if (target && target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId)
    }
  }

  return { offset, dragging, onPointerDown, onPointerMove, onPointerUp }
}
