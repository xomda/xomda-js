import { defineComponent, type SlotsType, type VNode } from 'vue'

import styles from './DiagramCanvas.module.scss'

export const DiagramCanvas = defineComponent({
  name: 'XDiagramCanvas',
  slots: Object as SlotsType<{
    default: () => VNode[]
  }>,
  setup(props, { slots }) {
    return () => (
      <div class={styles.canvas}>
        <div class={styles.inner}>{slots.default?.()}</div>
      </div>
    )
  },
})
