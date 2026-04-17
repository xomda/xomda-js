import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  type SlotsType,
  type VNode,
  watch,
} from 'vue'

import {
  CANVAS_GRID_SNAP_KEY,
  CANVAS_INERTIA_KEY,
  CANVAS_MODE_KEY,
  GRID_SIZE,
  snap,
  useCanvasPan,
  useCanvasZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_SLIDER_STEP,
} from '../../composables'
/** Wheel-delta → zoom multiplier slope. ~10% per mouse-wheel notch (100 px). */
const WHEEL_ZOOM_INTENSITY = 0.0015
import type { Layout } from '../../types'
import styles from './DiagramCanvas.module.scss'
import { gridCellPx } from './gridAlignment'

/** World units per grid cell — single source of truth from useCanvasLayout. */
const GRID_WORLD_PX = GRID_SIZE

/** Velocity below this (screen px / ms) ends the inertia glide. */
const INERTIA_VEL_MIN = 0.02
/** Sample window for instantaneous velocity (ms). */
const VEL_SAMPLE_MS = 60

export const DiagramCanvas = defineComponent({
  name: 'XDiagramCanvas',
  props: {
    layout: {
      type: Object as PropType<Layout>,
      default: () => ({}),
    },
    /**
     * When true, render the zero-point picker overlay: a crosshair that
     * follows the pointer over the viewport. Left-click emits
     * `pick-zero-point` with the world coordinates of the click; Escape
     * emits `cancel-zero-point`. The parent owns the mode flag so the
     * mini-toolbar button can drive the on/off state.
     */
    zeroPointMode: {
      type: Boolean,
      default: false,
    },
    /**
     * When true, wheel/trackpad pan is suppressed. The consumer flips
     * this on when an item is selected so a stray two-finger swipe
     * doesn't pull the scene out from under the side-panel editor.
     */
    wheelPanDisabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'pick-zero-point': (_payload: { x: number; y: number }) => true,
    'cancel-zero-point': () => true,
    /**
     * Fired when the user clicks the empty canvas background — no node
     * was hit and the gesture didn't turn into a pan. The payload is
     * the pointer position in canvas-area-local pixels (so the
     * consumer can anchor a popup right where the user clicked).
     */
    'background-click': (_payload: { top: number; left: number }) => true,
  },
  slots: Object as SlotsType<{
    default: () => VNode[]
  }>,
  setup(props, { slots, emit }) {
    const { zoom, setZoom, zoomIn, zoomOut, reset } = useCanvasZoom()
    const { panX, panY, pan, setPan, resetPan } = useCanvasPan()
    // Per-frame velocity-retention factor for inertial pan. Injected by
    // the consuming app (App.tsx wires it to the local-storage pref);
    // `0` disables inertia entirely; ~0.92 is "natural" feel.
    const inertia = inject(CANVAS_INERTIA_KEY, ref(0.92))
    // Same canvas-mode injection the node drag composable reads, so
    // pan-mode lets the user grab anywhere — including a node — to
    // slide the scene.
    const canvasMode = inject(CANVAS_MODE_KEY, ref<'items' | 'pan'>('items'))
    // When true, the camera advances one grid cell at a time. We keep
    // the stored pan continuous (sub-cell input still accumulates in
    // `panX`/`panY`) and only snap on *read* — so a slow drag eventually
    // crosses the half-cell threshold and the scene jumps by a cell, and
    // toggling grid-snap off afterwards resumes smooth panning without
    // losing the accumulated offset.
    const gridSnap = inject(CANVAS_GRID_SNAP_KEY, ref(false))

    // Raw `zoom` drives both the inner-element scale and the painted
    // grid's `background-size` so node world-coords and grid lines
    // stay locked at every zoom level (a node at world x = N·24 lands
    // exactly on the Nth grid line because both are multiplied by the
    // same factor). An earlier version snapped `displayZoom` to
    // `Math.round(zoom · 24) / 24` to keep `background-size` an
    // integer pixel value — that produced a crisper grid but turned
    // continuous wheel/pinch zoom into ~4% staircases. We accept
    // sub-pixel rasterisation shimmer along grid tile edges during a
    // zoom gesture in exchange for a smooth glide.
    const displayZoom = computed(() => zoom.value)
    const cellPx = computed(() => gridCellPx(zoom.value, GRID_WORLD_PX))
    // Pan as rendered: snapped to grid steps when `gridSnap` is on, raw
    // otherwise. Use these wherever pan affects screen position — render
    // transform, painted background-position, client→world conversion
    // — so the math agrees with what the user sees. The raw `panX`/
    // `panY` accumulators are still the source of truth for input.
    const effectivePanX = computed(() => {
      if (!gridSnap.value) return panX.value
      const cell = cellPx.value
      return Math.round(panX.value / cell) * cell
    })
    const effectivePanY = computed(() => {
      if (!gridSnap.value) return panY.value
      const cell = cellPx.value
      return Math.round(panY.value / cell) * cell
    })
    // When grid-snap turns off, commit the snapped position back into
    // the raw accumulators so the visible camera doesn't jump to the
    // sub-cell drift that built up while snapping was on. (Turning *on*
    // is also a snap — we leave that one as-is since the jump is the
    // user's intent: "align my view to the grid".)
    watch(gridSnap, (on, wasOn) => {
      if (wasOn && !on) {
        const cell = cellPx.value
        panX.value = Math.round(panX.value / cell) * cell
        panY.value = Math.round(panY.value / cell) * cell
      }
    })

    // ── Drag-to-pan with inertia ────────────────────────────────────────────
    // The canvas is an infinite-feeling stage: no scrollbars. To navigate,
    // the user grabs the empty background (or holds middle-mouse anywhere)
    // and drags. On release, we coast along the last-known velocity with an
    // exponential decay so the gesture feels alive — Apple-trackpad style.
    // Middle-mouse drag works regardless of click target so the user always
    // has an escape hatch even when something covers the background.
    const panning = ref(false)
    // Cumulative drag distance for the current gesture. Used to
    // distinguish a real click (no movement → fire background-click)
    // from a drag (any movement past the threshold → suppress click).
    let panTotalDx = 0
    let panTotalDy = 0
    // Most-recent pointer position + timestamp samples used to derive
    // velocity at release time. We sample over a short rolling window
    // (VEL_SAMPLE_MS) so a slow start followed by a quick flick still
    // releases at the *flick* speed, not the average of the whole drag.
    const velSamples: { t: number; dx: number; dy: number }[] = []
    let inertiaRaf = 0
    function stopInertia() {
      if (inertiaRaf) cancelAnimationFrame(inertiaRaf)
      inertiaRaf = 0
    }
    function isPanTarget(target: EventTarget | null): boolean {
      // In pan-mode every drag on the canvas slides the scene, even
      // when the pointer lands on a node. In items-mode we only pan
      // when the pointer-down is on the background — otherwise the
      // node's own `useNodeDrag` handles the gesture.
      if (canvasMode.value === 'pan') return true
      if (!(target instanceof HTMLElement)) return false
      const vp = viewportEl.value
      const innerNode = innerEl.value
      return target === vp || target === innerNode
    }
    function onViewportPointerDown(e: PointerEvent) {
      // Middle-mouse always pans (preserves the long-standing escape hatch).
      // Left-mouse pans only when the gesture starts on the background, so
      // node selection / drag still works on top of node DOM.
      const isMiddle = e.button === 1
      const isLeftOnBg = e.button === 0 && isPanTarget(e.target)
      if (!isMiddle && !isLeftOnBg) return
      stopInertia()
      panning.value = true
      panTotalDx = 0
      panTotalDy = 0
      velSamples.length = 0
      velSamples.push({ t: performance.now(), dx: 0, dy: 0 })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    }
    function onViewportPointerMove(e: PointerEvent) {
      if (!panning.value) return
      pan(e.movementX, e.movementY)
      panTotalDx += e.movementX
      panTotalDy += e.movementY
      const now = performance.now()
      velSamples.push({ t: now, dx: e.movementX, dy: e.movementY })
      // Trim samples older than the rolling window.
      while (velSamples.length > 1 && now - velSamples[0]!.t > VEL_SAMPLE_MS) {
        velSamples.shift()
      }
    }
    function onViewportPointerUp(e: PointerEvent) {
      if (!panning.value) return
      panning.value = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      // No drag movement → treat as a click on the canvas background.
      // Suppress the click when the pointer-up follows a real drag so
      // releasing a long pan doesn't accidentally open the toolbar.
      const moved = Math.hypot(panTotalDx, panTotalDy)
      if (moved < 3 && e.button === 0 && isPanTarget(e.target)) {
        const vp = viewportEl.value
        const rect = vp?.getBoundingClientRect()
        if (rect) {
          emit('background-click', {
            top: e.clientY - rect.top,
            left: e.clientX - rect.left,
          })
        }
      }
      panTotalDx = 0
      panTotalDy = 0
      // Compute release velocity from the rolling sample window. Sum
      // of recent deltas / window duration ≈ instantaneous velocity.
      if (velSamples.length < 2 || inertia.value <= 0) {
        velSamples.length = 0
        return
      }
      const first = velSamples[0]!
      const last = velSamples[velSamples.length - 1]!
      const dt = Math.max(1, last.t - first.t)
      let sumDx = 0
      let sumDy = 0
      for (let i = 1; i < velSamples.length; i++) {
        sumDx += velSamples[i]!.dx
        sumDy += velSamples[i]!.dy
      }
      // Velocity in screen px per ms.
      let vx = sumDx / dt
      let vy = sumDy / dt
      velSamples.length = 0
      if (Math.hypot(vx, vy) < INERTIA_VEL_MIN) return
      // Inertia is a per-frame retention factor; the timer below applies
      // the velocity each rAF tick (~16.7 ms at 60 Hz) and multiplies it
      // by the factor so the glide tapers naturally.
      let lastTick = performance.now()
      const tick = (now: number) => {
        const frameDt = now - lastTick
        lastTick = now
        pan(vx * frameDt, vy * frameDt)
        // Frame-rate-independent decay: scale `inertia` by frame time so a
        // 30 Hz monitor doesn't glide twice as far as a 60 Hz one.
        const decay = Math.pow(inertia.value, frameDt / 16.6667)
        vx *= decay
        vy *= decay
        if (Math.hypot(vx, vy) < INERTIA_VEL_MIN) {
          inertiaRaf = 0
          return
        }
        inertiaRaf = requestAnimationFrame(tick)
      }
      inertiaRaf = requestAnimationFrame(tick)
    }

    // ── Wheel/trackpad pan ──────────────────────────────────────────────────
    // Two-finger trackpad scrolling (and mouse-wheel) pans the scene the same
    // way a drag does — no conflict with item drag (pointer-based).
    //
    // Two cases skip pan:
    //  1. `wheelPanDisabled` is on (the consumer flips this when an item is
    //     selected, so the side-panel editor stays under the cursor).
    //  2. The pointer is over a nested scrollable element. Any axis-scrollable
    //     ancestor "claims" the wheel entirely — even if the wheel delta is
    //     cross-axis to its scroll direction. Without that, a vertically-
    //     scrollable attribute list would scroll itself on Y, but the canvas
    //     would simultaneously pan on the X jitter from the same gesture,
    //     which is disorienting.
    function isScrollableElement(el: HTMLElement): boolean {
      const style = getComputedStyle(el)
      const scrollY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight
      const scrollX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        el.scrollWidth > el.clientWidth
      return scrollY || scrollX
    }
    function onViewportWheel(e: WheelEvent) {
      if (props.wheelPanDisabled) return
      // Ctrl/Cmd+wheel zooms instead of panning — matches the convention
      // used by browsers, maps, and design tools. Trackpad pinch gestures
      // also surface as wheel events with `ctrlKey: true`, so this path
      // is what makes pinch-to-zoom feel native. Bypasses the
      // scrollable-ancestor escape hatch below: a held modifier is an
      // explicit zoom intent that should win over a nested scroll.
      if (e.ctrlKey || e.metaKey) {
        const vp = viewportEl.value
        if (!vp) return
        e.preventDefault()
        stopInertia()
        const rect = vp.getBoundingClientRect()
        const localX = e.clientX - rect.left
        const localY = e.clientY - rect.top
        const oldDisplayZoom = displayZoom.value
        // World point under the cursor before the zoom step — we anchor
        // the gesture here so zooming feels like the cursor stays glued
        // to the same logical point in the scene.
        // Use the *rendered* pan so the world-anchor matches what's on
        // screen — without this, the cursor would un-glue from the
        // logical point under it the moment grid-snap is active.
        const worldX = (localX - effectivePanX.value) / oldDisplayZoom
        const worldY = (localY - effectivePanY.value) / oldDisplayZoom
        // Write `zoom` directly: `setZoom` rounds to 2 decimals, which
        // discards trackpad-pinch deltas (factors like 0.9999) and
        // produces jerky stair-step zoom instead of a smooth glide.
        const next = zoom.value * Math.exp(-e.deltaY * WHEEL_ZOOM_INTENSITY)
        zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
        // `displayZoom` is a computed derived from `zoom` — reads the
        // post-update value synchronously.
        const newDisplayZoom = displayZoom.value
        setPan(localX - worldX * newDisplayZoom, localY - worldY * newDisplayZoom)
        return
      }
      const root = viewportEl.value
      let el: Element | null = e.target instanceof Element ? e.target : null
      while (el && el !== root) {
        if (el instanceof HTMLElement && isScrollableElement(el)) {
          // Let the browser handle the inner scroll natively; the inner
          // element owns the whole gesture (both axes) for the duration
          // of this wheel event.
          return
        }
        el = el.parentElement
      }
      e.preventDefault()
      stopInertia()
      // Wheel deltas are in the *opposite* direction of what we want to pan:
      // scrolling down moves the content up, i.e. shifts the camera down
      // (negative pan). Same for X.
      pan(-e.deltaX, -e.deltaY)
    }

    // ── Zero-point picker (C5) ──────────────────────────────────────────────
    // The viewport's bounding rect is the screen → local-coords basis. World
    // coords come from undoing pan and zoom: world = (local + scroll - pan) / zoom.
    // Cancel on Escape; the parent re-renders the canvas with mode=false.
    const viewportEl = ref<HTMLElement | null>(null)
    const innerEl = ref<HTMLElement | null>(null)
    const crosshairX = ref(0)
    const crosshairY = ref(0)

    function clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
      const vp = viewportEl.value
      if (!vp) return { x: 0, y: 0 }
      const rect = vp.getBoundingClientRect()
      // Viewport is `overflow: hidden` — no scroll offset to undo.
      // Subtract pan, divide by zoom: world space.
      const localX = clientX - rect.left - effectivePanX.value
      const localY = clientY - rect.top - effectivePanY.value
      return { x: localX / displayZoom.value, y: localY / displayZoom.value }
    }

    function onViewportMouseMoveTrack(e: MouseEvent) {
      if (!props.zeroPointMode) return
      const vp = viewportEl.value
      if (!vp) return
      // Snap the crosshair to the grid in world space so the visible
      // intersection always lands on a valid grid position — feedback
      // that matches what `pick-zero-point` would actually emit.
      const world = clientToWorld(e.clientX, e.clientY)
      const snappedWorldX = snap(world.x, GRID_SIZE)
      const snappedWorldY = snap(world.y, GRID_SIZE)
      // Inverse map: world → viewport-local pixel.
      crosshairX.value = snappedWorldX * displayZoom.value + effectivePanX.value
      crosshairY.value = snappedWorldY * displayZoom.value + effectivePanY.value
    }

    function onZeroPointClick(e: MouseEvent) {
      if (!props.zeroPointMode) return
      // Left button only — middle stays reserved for pan, right is system menu.
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      emit('pick-zero-point', clientToWorld(e.clientX, e.clientY))
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && props.zeroPointMode) {
        e.preventDefault()
        emit('cancel-zero-point')
      }
    }
    // Capture-phase click handler — pre-empts Package/Entity selection so
    // a click inside zero-point mode picks the origin regardless of what
    // sits under the cursor. Attached via DOM addEventListener because Vue
    // JSX doesn't expose `onClickCapture` in its prop types here.
    function onCaptureClick(e: Event) {
      onZeroPointClick(e as MouseEvent)
    }
    onMounted(() => {
      window.addEventListener('keydown', onKeydown)
      viewportEl.value?.addEventListener('click', onCaptureClick, { capture: true })
      // `wheel` defaults to passive listeners on most browsers, which silently
      // ignores preventDefault. We need to suppress the browser's own scroll
      // for our pan handling, so attach it explicitly as non-passive.
      viewportEl.value?.addEventListener('wheel', onViewportWheel, { passive: false })
    })
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeydown)
      viewportEl.value?.removeEventListener('click', onCaptureClick, { capture: true })
      viewportEl.value?.removeEventListener('wheel', onViewportWheel)
      stopInertia()
    })

    // Reset crosshair to a sensible starting position when the picker opens.
    watch(
      () => props.zeroPointMode,
      (on) => {
        if (!on) return
        const vp = viewportEl.value
        if (!vp) return
        crosshairX.value = vp.clientWidth / 2
        crosshairY.value = vp.clientHeight / 2
      }
    )

    return () => (
      <div
        class={styles.canvas}
        style={{
          // World-grid unit in unscaled (pre-zoom) pixels — exposed to inner
          // components (Package padding, header height, ...) so the visual
          // grid stays the single source of truth at the CSS layer too.
          '--grid-size': `${GRID_WORLD_PX}px`,
        }}
      >
        <div
          ref={viewportEl}
          class={styles.viewport}
          style={{
            '--grid-cell': `${cellPx.value}px`,
            // Background grid tracks pan so it reads as a fixed world
            // grid the camera slides over (instead of stamping itself
            // onto the viewport rect).
            backgroundPosition: `${effectivePanX.value}px ${effectivePanY.value}px`,
            cursor: props.zeroPointMode
              ? 'crosshair'
              : panning.value
                ? 'grabbing'
                : canvasMode.value === 'pan'
                  ? 'grab'
                  : 'default',
          }}
          onPointerdown={onViewportPointerDown}
          onPointermove={onViewportPointerMove}
          onPointerup={onViewportPointerUp}
          onPointercancel={onViewportPointerUp}
          onMousemove={onViewportMouseMoveTrack}
        >
          <div
            ref={innerEl}
            class={styles.inner}
            style={{
              transform: `translate(${effectivePanX.value}px, ${effectivePanY.value}px) scale(${displayZoom.value})`,
              transformOrigin: 'top left',
            }}
          >
            {slots.default?.()}
          </div>
          {props.zeroPointMode && (
            <>
              <div class={styles.zeroPointVLine} style={{ left: `${crosshairX.value}px` }} />
              <div class={styles.zeroPointHLine} style={{ top: `${crosshairY.value}px` }} />
              <div class={styles.zeroPointHint}>Click to set new origin · Esc to cancel</div>
            </>
          )}
        </div>
        <div
          class={styles.zoomControls}
          onPointerdown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div class={styles.zoomExpanded}>
            <button
              type="button"
              class={styles.zoomBtn}
              onClick={zoomOut}
              disabled={zoom.value <= ZOOM_MIN}
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              class={styles.zoomSlider}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_SLIDER_STEP}
              value={zoom.value}
              onInput={(e) => setZoom(Number((e.target as HTMLInputElement).value))}
              title="Zoom"
              aria-label="Zoom level"
            />
            <button
              type="button"
              class={styles.zoomBtn}
              onClick={zoomIn}
              disabled={zoom.value >= ZOOM_MAX}
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <button
            type="button"
            class={styles.zoomLabel}
            // Reset zoom AND pan so the user has a single "home" escape
            // hatch — important now that scrollbars are gone, since the
            // viewport could otherwise drift arbitrarily far from
            // content over a long session.
            onClick={() => {
              stopInertia()
              reset()
              resetPan()
            }}
            title="Reset view (zoom 100%, recenter)"
            aria-label={`Current zoom ${Math.round(zoom.value * 100)} percent — click to reset view`}
          >
            {Math.round(zoom.value * 100)}%
          </button>
        </div>
      </div>
    )
  },
})
