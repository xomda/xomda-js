import { computed, defineComponent, type PropType, type SlotsType, type VNode } from 'vue'

import { useCanvasZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_SLIDER_STEP } from '../../composables'
import type { Layout } from '../../types'
import styles from './DiagramCanvas.module.scss'
import { gridCellPx } from './gridAlignment'

/** World units per grid cell — mirrors `GRID_SIZE` in useCanvasLayout. */
const GRID_WORLD_PX = 24

export const DiagramCanvas = defineComponent({
  name: 'XDiagramCanvas',
  props: {
    layout: {
      type: Object as PropType<Layout>,
      default: () => ({}),
    },
  },
  slots: Object as SlotsType<{
    default: () => VNode[]
  }>,
  setup(props, { slots }) {
    const { zoom, setZoom, zoomIn, zoomOut, reset } = useCanvasZoom()

    // Pixel-perfect alignment between the painted grid and the snapped
    // node positions at every zoom level. `cellPx` is the rounded
    // integer pixel size of one grid cell; CSS `background-size` is
    // then a whole-pixel value, so the browser doesn't rasterise the
    // 1px grid line at different offsets across tiles (which it does
    // at fractional sizes, producing visible drift). The inner scale
    // is derived from `cellPx / GRID_WORLD_PX`, not the raw slider
    // value, so a node at world x = N·24 lands exactly on the Nth
    // grid line. The slider still shows the raw zoom percentage.
    const cellPx = computed(() => gridCellPx(zoom.value, GRID_WORLD_PX))
    const displayZoom = computed(() => cellPx.value / GRID_WORLD_PX)

    return () => (
      <div class={styles.canvas}>
        <div class={styles.viewport} style={{ '--grid-cell': `${cellPx.value}px` }}>
          <div
            class={styles.inner}
            style={{
              transform: `scale(${displayZoom.value})`,
              transformOrigin: 'top left',
            }}
          >
            {slots.default?.()}
          </div>
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
            />
            <button
              type="button"
              class={styles.zoomBtn}
              onClick={zoomIn}
              disabled={zoom.value >= ZOOM_MAX}
              title="Zoom in"
            >
              +
            </button>
          </div>
          <button type="button" class={styles.zoomLabel} onClick={reset} title="Reset zoom (100%)">
            {Math.round(zoom.value * 100)}%
          </button>
        </div>
      </div>
    )
  },
})
