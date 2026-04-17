import { defineComponent, type SlotsType, type VNode } from 'vue'
import { VDefaultsProvider } from 'vuetify/components'

import styles from './CellFormFields.module.scss'

const FIELD_DEFAULTS = {
  VTextField: {
    density: 'compact' as const,
    variant: 'outlined' as const,
    hideDetails: 'auto' as const,
  },
  VSelect: {
    density: 'compact' as const,
    variant: 'outlined' as const,
    hideDetails: 'auto' as const,
  },
  VTextarea: {
    density: 'compact' as const,
    variant: 'outlined' as const,
    hideDetails: 'auto' as const,
  },
  VCheckbox: {
    density: 'compact' as const,
    hideDetails: 'auto' as const,
  },
}

export const CellFormFields = defineComponent({
  name: 'CellFormFields',
  slots: Object as SlotsType<{ default: () => VNode[] }>,
  setup(_props, { slots }) {
    return () => (
      <div class={styles.cellFormFields}>
        <VDefaultsProvider defaults={FIELD_DEFAULTS}>{slots.default?.()}</VDefaultsProvider>
      </div>
    )
  },
})
