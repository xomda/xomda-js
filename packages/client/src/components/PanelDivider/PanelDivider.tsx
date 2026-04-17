import { computed, defineComponent, type PropType, ref } from 'vue'

import styles from './PanelDivider.module.scss'

export const PanelDivider = defineComponent({
  name: 'PanelDivider',
  props: {
    orientation: {
      type: String as PropType<'horizontal' | 'vertical'>,
      default: 'horizontal',
    },
  },
  emits: ['resize'],
  setup(props, { emit }) {
    const handleVisible = ref(false)
    const dragging = ref(false)
    const crossPos = ref(0)
    const dragDirection = ref<'neg' | 'pos' | null>(null)
    let hoverTimer: ReturnType<typeof setTimeout> | null = null
    let lastMain = 0

    const isVertical = computed(() => props.orientation === 'vertical')

    function onPointerEnter() {
      hoverTimer = setTimeout(() => {
        handleVisible.value = true
      }, 350)
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
      lastMain = isVertical.value ? e.clientY : e.clientX
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      crossPos.value = isVertical.value ? e.clientX - rect.left : e.clientY - rect.top
      if (!dragging.value) return
      const main = isVertical.value ? e.clientY : e.clientX
      const delta = main - lastMain
      lastMain = main
      if (delta !== 0) {
        dragDirection.value = delta < 0 ? 'neg' : 'pos'
        emit('resize', delta)
      }
    }

    function onPointerUp() {
      dragging.value = false
      handleVisible.value = false
      dragDirection.value = null
    }

    return () => {
      const vertical = isVertical.value
      const dir = dragDirection.value
      return (
        <div
          class={[
            styles.divider,
            vertical ? styles.vertical : styles.horizontal,
            dragging.value && styles.dragging,
            dir === 'neg' && (vertical ? styles.draggingUp : styles.draggingLeft),
            dir === 'pos' && (vertical ? styles.draggingDown : styles.draggingRight),
          ]}
          role="separator"
          aria-orientation={vertical ? 'horizontal' : 'vertical'}
          data-panel-divider={vertical ? 'horizontal' : 'vertical'}
          onPointerenter={onPointerEnter}
          onPointerleave={onPointerLeave}
          onPointerdown={onPointerDown}
          onPointermove={onPointerMove}
          onPointerup={onPointerUp}
        >
          <div
            class={[styles.handle, handleVisible.value && styles.handleVisible]}
            style={vertical ? { left: `${crossPos.value}px` } : { top: `${crossPos.value}px` }}
          />
        </div>
      )
    }
  },
})
