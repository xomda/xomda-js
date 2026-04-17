import { ChevronLeftIcon, ChevronRightIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { VIcon } from 'vuetify/components'

import styles from './ViewShell.module.scss'

/**
 * `ViewShell` is the standard layout chrome for a view that has 0–2 side
 * panels and a main stage. It owns:
 *
 *  - Side widths (controlled via v-model or internal state).
 *  - Collapse state per side, with a chevron button on each divider.
 *  - Pointer-driven resize of each side panel.
 *
 * Slots:
 *  - `left` — optional left side panel content (e.g. a tree view).
 *  - `default` — main stage (always rendered).
 *  - `right` — optional right side panel content (e.g. properties panel).
 *
 * Views should reach for `ViewShell` rather than re-rolling the
 * divider + collapse + width plumbing themselves.
 */
export const ViewShell = defineComponent({
  name: 'ViewShell',
  props: {
    leftWidth: { type: Number as PropType<number>, default: 280 },
    rightWidth: { type: Number as PropType<number>, default: 320 },
    leftMin: { type: Number, default: 160 },
    leftMax: { type: Number, default: 560 },
    rightMin: { type: Number, default: 200 },
    rightMax: { type: Number, default: 640 },
    leftCollapsed: { type: Boolean, default: false },
    rightCollapsed: { type: Boolean, default: false },
    /** Hide the left divider/collapse-button when no `left` slot is given. */
    leftHidden: { type: Boolean, default: false },
    rightHidden: { type: Boolean, default: false },
  },
  emits: {
    'update:leftWidth': (_v: number) => true,
    'update:rightWidth': (_v: number) => true,
    'update:leftCollapsed': (_v: boolean) => true,
    'update:rightCollapsed': (_v: boolean) => true,
  },
  setup(props, { slots, emit }) {
    // Uncontrolled fallbacks when the parent doesn't bind v-model.
    const leftWidthInternal = ref(props.leftWidth)
    const rightWidthInternal = ref(props.rightWidth)
    const leftCollapsedInternal = ref(props.leftCollapsed)
    const rightCollapsedInternal = ref(props.rightCollapsed)

    const leftWidth = computed(() => leftWidthInternal.value)
    const rightWidth = computed(() => rightWidthInternal.value)
    const leftCollapsed = computed(() => leftCollapsedInternal.value)
    const rightCollapsed = computed(() => rightCollapsedInternal.value)

    function setLeftWidth(v: number) {
      const clamped = Math.max(props.leftMin, Math.min(props.leftMax, v))
      leftWidthInternal.value = clamped
      emit('update:leftWidth', clamped)
    }
    function setRightWidth(v: number) {
      const clamped = Math.max(props.rightMin, Math.min(props.rightMax, v))
      rightWidthInternal.value = clamped
      emit('update:rightWidth', clamped)
    }
    function setLeftCollapsed(v: boolean) {
      leftCollapsedInternal.value = v
      emit('update:leftCollapsed', v)
    }
    function setRightCollapsed(v: boolean) {
      rightCollapsedInternal.value = v
      emit('update:rightCollapsed', v)
    }

    function makeDragHandlers(side: 'left' | 'right') {
      let last = 0
      let active = false
      const dragging = ref(false)
      function onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return
        active = true
        dragging.value = true
        last = e.clientX
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        e.preventDefault()
      }
      function onPointerMove(e: PointerEvent) {
        if (!active) return
        const dx = e.clientX - last
        last = e.clientX
        if (side === 'left') setLeftWidth(leftWidthInternal.value + dx)
        else setRightWidth(rightWidthInternal.value - dx)
      }
      function onPointerUp() {
        active = false
        dragging.value = false
      }
      return { dragging, onPointerDown, onPointerMove, onPointerUp }
    }

    const leftDrag = makeDragHandlers('left')
    const rightDrag = makeDragHandlers('right')

    return () => {
      const hasLeft = !props.leftHidden && (slots.left != null || leftCollapsed.value)
      const hasRight = !props.rightHidden && (slots.right != null || rightCollapsed.value)

      return (
        <div class={styles.shell}>
          {hasLeft && (
            <>
              <div
                class={[styles.side, leftCollapsed.value && styles.sideCollapsed]}
                style={{ width: `${leftWidth.value}px` }}
              >
                {!leftCollapsed.value && slots.left?.()}
              </div>
              <div
                class={[styles.divider, leftDrag.dragging.value && styles.dividerDragging]}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize left panel"
                onPointerdown={leftDrag.onPointerDown}
                onPointermove={leftDrag.onPointerMove}
                onPointerup={leftDrag.onPointerUp}
                onPointercancel={leftDrag.onPointerUp}
              >
                <div class={styles.dividerLine} />
                <button
                  type="button"
                  class={[
                    styles.collapseBtn,
                    styles.collapseBtnLeft,
                    leftCollapsed.value && styles.collapseBtnPinned,
                  ]}
                  aria-label={leftCollapsed.value ? 'Expand left panel' : 'Collapse left panel'}
                  onClick={() => setLeftCollapsed(!leftCollapsed.value)}
                >
                  <VIcon
                    icon={leftCollapsed.value ? ChevronRightIcon : ChevronLeftIcon}
                    size="16"
                  />
                </button>
              </div>
            </>
          )}

          <div class={styles.main}>{slots.default?.()}</div>

          {hasRight && (
            <>
              <div
                class={[styles.divider, rightDrag.dragging.value && styles.dividerDragging]}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize right panel"
                onPointerdown={rightDrag.onPointerDown}
                onPointermove={rightDrag.onPointerMove}
                onPointerup={rightDrag.onPointerUp}
                onPointercancel={rightDrag.onPointerUp}
              >
                <div class={styles.dividerLine} />
                <button
                  type="button"
                  class={[
                    styles.collapseBtn,
                    styles.collapseBtnRight,
                    rightCollapsed.value && styles.collapseBtnPinned,
                  ]}
                  aria-label={rightCollapsed.value ? 'Expand right panel' : 'Collapse right panel'}
                  onClick={() => setRightCollapsed(!rightCollapsed.value)}
                >
                  <VIcon
                    icon={rightCollapsed.value ? ChevronLeftIcon : ChevronRightIcon}
                    size="16"
                  />
                </button>
              </div>
              <div
                class={[styles.side, rightCollapsed.value && styles.sideCollapsed]}
                style={{ width: `${rightWidth.value}px` }}
              >
                {!rightCollapsed.value && slots.right?.()}
              </div>
            </>
          )}
        </div>
      )
    }
  },
})
