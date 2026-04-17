import { ChevronDownIcon, ChevronRightIcon } from '@xomda/icons'
import { defineComponent, ref } from 'vue'
import { VBtn, VExpandTransition } from 'vuetify/components'

import styles from './Collapsible.module.scss'

export const Collapsible = defineComponent({
  name: 'Collapsible',
  props: {
    modelValue: { type: Boolean, default: true },
    label: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_open: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const internalOpen = ref(props.modelValue)

    function toggle() {
      const next = !internalOpen.value
      internalOpen.value = next
      emit('update:modelValue', next)
    }

    return () => (
      <div class={styles.collapsible}>
        <div class={styles.header} onClick={toggle}>
          <VBtn
            icon={internalOpen.value ? (ChevronDownIcon as any) : (ChevronRightIcon as any)}
            size="x-small"
            variant="text"
            density="compact"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              toggle()
            }}
          />
          {props.label && <span class={styles.label}>{props.label}</span>}
        </div>
        <VExpandTransition>
          {internalOpen.value && <div>{slots.default?.()}</div>}
        </VExpandTransition>
      </div>
    )
  },
})
