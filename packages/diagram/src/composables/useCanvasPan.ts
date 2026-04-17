import { inject, type InjectionKey, type Ref, ref } from 'vue'

/**
 * Pan offset (in unscaled world pixels) applied to the canvas inner
 * group *in addition to* its overflow-auto scroll position. The
 * combination lets users:
 *
 *  - Drag the world origin to negative coordinates (something the bare
 *    overflow scroll can't reach — its minimum is `0,0`).
 *  - Re-centre on demand without losing the per-package layout entries.
 *
 * Parallels {@link CANVAS_ZOOM_KEY}: the diagram package owns the
 * composable, the consuming app (`@xomda/client`) provides the
 * persistent refs (backed by its preferences store). Standalone
 * consumers (Storybook, unit tests) get the in-memory fallbacks below.
 */
export const CANVAS_PAN_X_KEY: InjectionKey<Ref<number>> = Symbol('xomda.canvasPanX')
export const CANVAS_PAN_Y_KEY: InjectionKey<Ref<number>> = Symbol('xomda.canvasPanY')

/**
 * Per-frame velocity retention factor for drag-pan inertia, in 0..1.
 *   0   → no inertia: pan stops the instant the user releases.
 *   ~0.9 → "natural" Apple-style trackpad feel: kinetic glide that
 *          fades over ~half a second at 60 fps.
 *   1   → never decays (don't ship this, it's a runaway).
 * The consumer supplies a Vue ref so it can be wired to a pref store.
 */
export const CANVAS_INERTIA_KEY: InjectionKey<Ref<number>> = Symbol('xomda.canvasInertia')

/**
 * Canvas drag-mode injection key. The consuming app provides a ref
 * whose value is `'items'` (default — drag a node to move it) or
 * `'pan'` (drag a node pans the scene; the node itself is inert).
 * Diagram nodes' `useNodeDrag` reads this so the gesture interpretation
 * matches the user's mode toggle without prop-drilling through every
 * node type.
 */
export const CANVAS_MODE_KEY: InjectionKey<Ref<'items' | 'pan'>> = Symbol('xomda.canvasMode')

/**
 * Grid-snap pan injection key. When the provided ref is `true`, the
 * canvas pan offset (drag, wheel/trackpad, inertia) is rounded to the
 * nearest visible grid step instead of moving continuously — so the
 * camera advances one cell at a time and the painted grid lines never
 * drift off integer screen positions. Sub-cell pointer movement still
 * accumulates: a slow drag eventually crosses the half-cell threshold
 * and the scene jumps. The consumer wires this to a user preference.
 */
export const CANVAS_GRID_SNAP_KEY: InjectionKey<Ref<boolean>> = Symbol('xomda.canvasGridSnap')

const fallbackPanX: Ref<number> = ref(0)
const fallbackPanY: Ref<number> = ref(0)

export interface UseCanvasPanReturn {
  panX: Ref<number>
  panY: Ref<number>
  /** Shift the pan by a delta (typically driven by pointer move events). */
  pan(dx: number, dy: number): void
  /** Set absolute pan offsets. */
  setPan(x: number, y: number): void
  /** Re-centre the world origin. */
  resetPan(): void
}

export function useCanvasPan(): UseCanvasPanReturn {
  const panX = inject(CANVAS_PAN_X_KEY, fallbackPanX)
  const panY = inject(CANVAS_PAN_Y_KEY, fallbackPanY)

  function pan(dx: number, dy: number) {
    panX.value = Math.round(panX.value + dx)
    panY.value = Math.round(panY.value + dy)
  }
  function setPan(x: number, y: number) {
    panX.value = Math.round(x)
    panY.value = Math.round(y)
  }
  function resetPan() {
    panX.value = 0
    panY.value = 0
  }
  return { panX, panY, pan, setPan, resetPan }
}
