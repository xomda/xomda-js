import { CloseIcon, OpenWithIcon, PackageIcon, PointScanIcon, SelectToolIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import { VBtn, VBtnToggle, VTooltip } from 'vuetify/components'

import { useFloatingDrag } from '../../composables'
import styles from './SceneMiniToolbar.module.scss'

export type CanvasMode = 'items' | 'pan'

/**
 * Floating "scene" toolbar over the model canvas. Pops up when the
 * user clicks the empty canvas (i.e. not a node), and hosts the
 * canvas-wide controls that don't belong to any one diagram element:
 *
 *  - The drag-mode toggle: **Drag items** (default — drag a node moves
 *    it) vs **Drag scene** (drag a node pans the scene). Either way
 *    the background can always be grabbed to pan.
 *  - A close (×) button, so the user can dismiss the toolbar without
 *    having to click somewhere else.
 *
 * Positioning is identical to `ModelMiniToolbar`: SCSS pins it
 * top-left of the canvas; the consumer can override via an `anchor`
 * prop to place it at the click position.
 */
export const SceneMiniToolbar = defineComponent({
  name: 'SceneMiniToolbar',
  props: {
    mode: { type: String as PropType<CanvasMode>, default: 'items' },
    anchor: {
      type: Object as PropType<{ top: number; left: number } | null>,
      default: null,
    },
    onModeChange: {
      type: Function as PropType<(next: CanvasMode) => void>,
      default: undefined,
    },
    onClose: { type: Function as PropType<() => void>, default: undefined },
    /** Recenter the world origin around the user's pick. */
    onResetZeroPoint: { type: Function as PropType<() => void>, default: undefined },
    /** Open the "new package" dialog rooted at the model (no parent). */
    onAddPackage: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const drag = useFloatingDrag(() => props.anchor)
    const titleHandlers = {
      onPointerdown: drag.onPointerDown,
      onPointermove: drag.onPointerMove,
      onPointerup: drag.onPointerUp,
      onPointercancel: drag.onPointerUp,
    }
    return () => {
      const positionStyle = props.anchor
        ? {
            top: `${props.anchor.top + drag.offset.value.dy}px`,
            left: `${props.anchor.left + drag.offset.value.dx}px`,
          }
        : drag.offset.value.dx !== 0 || drag.offset.value.dy !== 0
          ? { transform: `translate(${drag.offset.value.dx}px, ${drag.offset.value.dy}px)` }
          : undefined
      return (
        <div
          class={styles.toolbar}
          style={positionStyle}
          role="toolbar"
          aria-label="Scene toolbar"
          // Stop click + pointerdown from bubbling to the canvas
          // background, which would otherwise interpret it as a new
          // empty-canvas click and re-trigger the toolbar.
          onPointerdown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span class={[styles.label, styles.labelDraggable]} {...titleHandlers}>
            Scene
          </span>
          {props.onAddPackage && (
            <>
              <VTooltip text="Add package" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={PackageIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Add package"
                      onClick={() => props.onAddPackage?.()}
                    />
                  ),
                }}
              </VTooltip>
              <div class={styles.divider} aria-hidden="true" />
            </>
          )}
          <VBtnToggle
            modelValue={props.mode}
            onUpdate:modelValue={(v: CanvasMode | undefined) => {
              if (!v) return
              props.onModeChange?.(v)
            }}
            mandatory
            divided
            density="comfortable"
            color="primary"
            class={styles.toggle}
          >
            <VTooltip text="Select tool (click items, drag to move)" location="bottom">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VBtn
                    {...tipProps}
                    value="items"
                    icon={SelectToolIcon}
                    size="small"
                    aria-label="Select tool"
                  />
                ),
              }}
            </VTooltip>
            <VTooltip text="Drag scene (pan everywhere)" location="bottom">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VBtn
                    {...tipProps}
                    value="pan"
                    icon={OpenWithIcon}
                    size="small"
                    aria-label="Drag scene mode"
                  />
                ),
              }}
            </VTooltip>
          </VBtnToggle>
          {props.onResetZeroPoint && (
            <>
              <div class={styles.divider} aria-hidden="true" />
              <VTooltip
                text="Reset zero point (recenters top-level packages, snapped to grid)"
                location="bottom"
              >
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={PointScanIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Reset zero point"
                      onClick={() => props.onResetZeroPoint?.()}
                    />
                  ),
                }}
              </VTooltip>
            </>
          )}
          {props.onClose && (
            <>
              <div class={styles.divider} aria-hidden="true" />
              <VTooltip text="Close" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon={CloseIcon}
                      variant="text"
                      size="small"
                      density="comfortable"
                      aria-label="Close scene toolbar"
                      onClick={() => props.onClose?.()}
                    />
                  ),
                }}
              </VTooltip>
            </>
          )}
        </div>
      )
    }
  },
})
