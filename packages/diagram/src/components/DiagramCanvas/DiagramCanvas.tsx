import { defineComponent, type PropType, type SlotsType, type VNode } from 'vue'

import { useCanvasZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../composables'
import type { Layout } from '../../types'
import styles from './DiagramCanvas.module.scss'

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

    return () => (
      <div class={styles.canvas}>
        <div class={styles.viewport}>
          <div
            class={styles.inner}
            style={{
              transform: `scale(${zoom.value})`,
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
              step={ZOOM_STEP}
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
          <button
            type="button"
            class={styles.zoomLabel}
            onClick={reset}
            title="Reset zoom (100%)"
          >
            {Math.round(zoom.value * 100)}%
          </button>
        </div>
      </div>
    )
  },
})
