import type { OverviewSection } from '@xomda/analysis-core'
import { defineComponent, type PropType } from 'vue'
import { VChip } from 'vuetify/components'

import styles from './ProjectOverview.module.scss'

type StatusSection = Extract<OverviewSection, { kind: 'status' }>

const TONE_COLORS: Record<StatusSection['tone'], string> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
}

export const StatusSection = defineComponent({
  name: 'StatusSection',
  props: {
    section: { type: Object as PropType<StatusSection>, required: true },
  },
  setup(props) {
    return () => (
      <div class={styles.status}>
        <div class={styles.statusLabel}>
          <VChip
            size="small"
            color={TONE_COLORS[props.section.tone]}
            variant="tonal"
            label
            class="mr-2"
          >
            {props.section.tone}
          </VChip>
          {props.section.label}
        </div>
        {props.section.sub ? <div class={styles.statusSub}>{props.section.sub}</div> : null}
      </div>
    )
  },
})
