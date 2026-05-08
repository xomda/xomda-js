import { defineComponent, type PropType, type SlotsType, type VNode } from 'vue'

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
    return () => (
      <div class={styles.canvas}>
        <div class={styles.inner}>{slots.default?.()}</div>
      </div>
    )
  },
})
