import { AddIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import { VBtn, VDivider, VList, VListItem, VMenu } from 'vuetify/components'

import styles from './CellSeparator.module.scss'

export const CellSeparator = defineComponent({
  name: 'CellSeparator',
  props: {
    cellTypes: { type: Array as PropType<string[]>, required: true },
    cellTypeLabels: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  },
  emits: {
    add: (_type: string) => true,
  },
  setup(props, { emit }) {
    return () => (
      <div class={styles.separator}>
        <VDivider class={styles.line} />
        <VMenu>
          {{
            activator: ({ props: menuProps }: any) => (
              <VBtn
                {...menuProps}
                icon={AddIcon as any}
                size="x-small"
                density="comfortable"
                variant="tonal"
                class={styles.btn}
              />
            ),
            default: () => (
              <VList density="compact">
                {props.cellTypes.map((type) => (
                  <VListItem
                    key={type}
                    title={props.cellTypeLabels[type] ?? type.charAt(0).toUpperCase() + type.slice(1)}
                    onClick={() => emit('add', type)}
                  />
                ))}
              </VList>
            ),
          }}
        </VMenu>
        <VDivider class={styles.line} />
      </div>
    )
  },
})
