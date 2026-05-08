import { defineComponent, ref } from 'vue'

import styles from './PanelDivider.module.scss'

export const PanelDivider = defineComponent({
  name: 'PanelDivider',
  emits: ['resize'],
  setup(_, { emit }) {
    const handleVisible = ref(false)
    const dragging = ref(false)
    const mouseY = ref(0)
    const dragDirection = ref<'left' | 'right' | null>(null)
    let hoverTimer: ReturnType<typeof setTimeout> | null = null
    let lastX = 0

    function onPointerEnter() {
      hoverTimer = setTimeout(() => {
        handleVisible.value = true
      }, 600)
    }

    function onPointerLeave() {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer)
        hoverTimer = null
      }
      if (!dragging.value) {
        handleVisible.value = false
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      dragging.value = true
      handleVisible.value = true
      dragDirection.value = null
      lastX = e.clientX
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      mouseY.value = e.clientY - rect.top
      if (!dragging.value) return
      const delta = e.clientX - lastX
      lastX = e.clientX
      if (delta !== 0) {
        dragDirection.value = delta < 0 ? 'left' : 'right'
        emit('resize', delta)
      }
    }

    function onPointerUp() {
      dragging.value = false
      handleVisible.value = false
      dragDirection.value = null
    }

    return () => (
      <div
        class={[
          styles.divider,
          dragging.value && styles.dragging,
          dragDirection.value === 'left' && styles.draggingLeft,
          dragDirection.value === 'right' && styles.draggingRight,
        ]}
        onPointerenter={onPointerEnter}
        onPointerleave={onPointerLeave}
        onPointerdown={onPointerDown}
        onPointermove={onPointerMove}
        onPointerup={onPointerUp}
      >
        {handleVisible.value && (
          <div class={styles.handle} style={{ top: `${mouseY.value}px` }} />
        )}
      </div>
    )
  },
})
