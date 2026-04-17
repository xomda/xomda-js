import { ListViewIcon, TreeViewIcon } from '@xomda/icons'
import { defineComponent } from 'vue'
import { VBtn, VBtnToggle, VIcon } from 'vuetify/components'

import styles from './ViewModeToggle.module.scss'

export type ViewMode = 'list' | 'tree'

export const ViewModeToggle = defineComponent({
  name: 'ViewModeToggle',
  props: {
    modelValue: { type: String as () => ViewMode, default: 'tree' },
  },
  emits: {
    'update:modelValue': (_value: ViewMode) => true,
  },
  setup(props, { emit }) {
    return () => (
      <VBtnToggle
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: ViewMode) => emit('update:modelValue', v)}
        mandatory
        density="compact"
        variant="outlined"
        divided
        aria-label="View mode"
        class={styles.toggle}
      >
        <VBtn value="tree" size="x-small" aria-label="Tree view">
          <VIcon icon={TreeViewIcon} size="x-small" />
        </VBtn>
        <VBtn value="list" size="x-small" aria-label="List view">
          <VIcon icon={ListViewIcon} size="x-small" />
        </VBtn>
      </VBtnToggle>
    )
  },
})
