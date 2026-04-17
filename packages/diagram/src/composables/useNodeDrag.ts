import { type Ref, ref } from 'vue'

import { findDropTarget, useCanvasDrag } from './useCanvasDrag'
import { snap } from './useCanvasLayout'

/** Move-to-package payload — same shape the model.router expects. */
export interface MoveToPackagePayload<TKind extends string> {
  type: TKind
  id: string
  targetPackageId: string
}

export interface UseNodeDragOptions<TKind extends string> {
  /** The diagram node's id (entity / enum / package). Reactive. */
  id: () => string
  /** The kind of node, used in the move-to-package payload. */
  kind: TKind
  /** Current absolute layout position. Reactive. */
  layout: () => { x: number; y: number }
  /** The DOM element representing the whole node — used for drop-target hit-testing. */
  el: Ref<HTMLElement | null>
  /** Parent package id, if any. `undefined` = top-level node (no cross-package drop). */
  parentPackageId: () => string | undefined
  /** Current zoom level (delta is divided by this so dragging stays 1:1 with cursor). */
  zoom: () => number
  /** True when the node is in absolute-positioned mode (the only mode that supports drag-to-move). */
  absolute: () => boolean
  /** Fires on every pointer-move with the snapped new position. */
  onMove: (id: string, x: number, y: number) => void
  /** Fires on pointer-up if the node was dropped into a different package. */
  onMoveToPackage: (payload: MoveToPackagePayload<TKind>) => void
}

export interface UseNodeDragReturn {
  /** True from pointer-down through pointer-up. Drives the "currently dragging" visual. */
  dragging: Ref<boolean>
  /** True between pointer-down + threshold movement and pointer-up. Use to suppress click handlers. */
  dragMoved: Ref<boolean>
  /** Attach to the draggable header's `onPointerdown`. */
  onPointerDown: (e: PointerEvent) => void
  /** Attach to `onPointermove`. */
  onPointerMove: (e: PointerEvent) => void
  /** Attach to `onPointerup`. */
  onPointerUp: (e: PointerEvent) => void
  /** Attach to `onPointercancel`. Restores idle state when the OS interrupts the drag. */
  onPointerCancel: (e: PointerEvent) => void
}

/** Screen-space movement (CSS pixels) before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 3

/**
 * Pointer-driven drag-to-reposition for a single diagram node.
 *
 * Encapsulates the state machine that was previously triplicated across
 * `Package`, `Entity`, and `Enum`:
 *
 * - left-button only; ignores secondary/middle-click so right-click menus
 *   and middle-click pan keep working.
 * - screen-space 3px move threshold before treating it as a drag — so a
 *   simple click still fires `onHeaderClick` even at high zoom (where 3
 *   world-px would be sub-pixel on screen).
 * - delta is divided by `zoom()` for the world-space `onMove` payload so
 *   the node tracks the cursor at every zoom.
 * - snaps the new position to the grid via {@link snap}.
 * - while dragging, performs a {@link findDropTarget} hit-test against the
 *   parent package; if the pointer leaves the parent, `canvasDrag` exposes
 *   the candidate target so other nodes can render the drop affordance.
 * - on release, if a different package is the candidate target, emits
 *   `onMoveToPackage` (and `canvasDrag.end()` clears global drag state).
 * - on `pointercancel` (OS interrupt — gesture cancel, alt-tab during a
 *   drag, browser chrome takeover) restores idle state and releases
 *   capture cleanly without emitting a move-to-package.
 *
 * **Pointer capture target.** Capture is taken on `e.currentTarget` — the
 * element the listener is wired on (the header). The Pointer Events spec
 * retargets *all* subsequent events for the captured pointer to fire **at**
 * that element; events bubble up from there. Capturing on a parent
 * (e.g. the node root) would silently break the drag — `pointermove`
 * listeners on the header are children of the parent in the DOM and would
 * never see the events. Don't use `e.target`: that's the most-specific
 * descendant the user clicked (an icon, a label) and can unmount.
 */
export function useNodeDrag<TKind extends string>(
  options: UseNodeDragOptions<TKind>
): UseNodeDragReturn {
  const canvasDrag = useCanvasDrag()

  const dragging = ref(false)
  const dragMoved = ref(false)
  const dragStartPointer = ref({ x: 0, y: 0 })
  const dragStartLayout = ref({ x: 0, y: 0 })
  // Track which DOM node owns the pointer capture so we can release it on
  // the exact element we acquired it from — capture is per-element.
  let capturedEl: HTMLElement | null = null
  let capturedPointerId: number | null = null

  function endDrag() {
    dragging.value = false
    canvasDrag.end()
    if (capturedEl && capturedPointerId !== null) {
      try {
        if (capturedEl.hasPointerCapture(capturedPointerId)) {
          capturedEl.releasePointerCapture(capturedPointerId)
        }
      } catch {
        // Element may have unmounted by now; safe to ignore.
      }
    }
    capturedEl = null
    capturedPointerId = null
  }

  function onPointerDown(e: PointerEvent) {
    if (!options.absolute() || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragging.value = true
    dragMoved.value = false
    dragStartPointer.value = { x: e.clientX, y: e.clientY }
    dragStartLayout.value = { ...options.layout() }
    canvasDrag.start(options.id())
    // Capture on the listener-bearing element (the header). Subsequent
    // pointer events for this id will fire AT this element and bubble
    // up — that's what the consumer's `onPointermove={…}` listener needs
    // to fire. Capturing on a parent breaks the drag (events would fire
    // at the parent and never reach the header's listener); capturing on
    // `e.target` (a child icon/label) risks losing capture if that node
    // unmounts mid-drag. `currentTarget` is the right fence.
    const target = (e.currentTarget as HTMLElement | null) ?? options.el.value
    if (target) {
      target.setPointerCapture(e.pointerId)
      capturedEl = target
      capturedPointerId = e.pointerId
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return
    const screenDx = e.clientX - dragStartPointer.value.x
    const screenDy = e.clientY - dragStartPointer.value.y
    // Threshold compares against on-screen pixels, not world pixels — at
    // zoom>1 a tiny screen jitter would otherwise register as a drag.
    if (Math.abs(screenDx) > DRAG_THRESHOLD_PX || Math.abs(screenDy) > DRAG_THRESHOLD_PX) {
      dragMoved.value = true
    }
    const z = options.zoom() || 1
    const newX = snap(Math.max(0, dragStartLayout.value.x + screenDx / z))
    const newY = snap(Math.max(0, dragStartLayout.value.y + screenDy / z))
    options.onMove(options.id(), newX, newY)

    const parentId = options.parentPackageId()
    if (parentId && options.el.value) {
      const target = findDropTarget(e.clientX, e.clientY, options.el.value, parentId)
      canvasDrag.setDropTarget(target)
    }
  }

  function onPointerUp(_e: PointerEvent) {
    if (!dragging.value) return
    const target = canvasDrag.dropTargetPackageId.value
    if (target && options.parentPackageId()) {
      options.onMoveToPackage({
        type: options.kind,
        id: options.id(),
        targetPackageId: target,
      })
    }
    endDrag()
  }

  function onPointerCancel(_e: PointerEvent) {
    // The OS or browser took control (gesture cancel, alt-tab during drag,
    // device lifted off the surface). Restore idle state without emitting
    // a move-to-package — the user didn't actually finish the drag.
    if (!dragging.value) return
    endDrag()
  }

  return {
    dragging,
    dragMoved,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
