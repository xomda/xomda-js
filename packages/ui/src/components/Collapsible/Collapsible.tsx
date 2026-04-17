import { ChevronDownIcon, ChevronRightIcon } from '@xomda/icons'
import { defineComponent, ref } from 'vue'
import { VBtn, VExpandTransition, VTooltip } from 'vuetify/components'

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
          <VTooltip text={internalOpen.value ? 'Collapse' : 'Expand'} location="top">
            {{
              activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                <VBtn
                  {...tipProps}
                  icon={internalOpen.value ? ChevronDownIcon : ChevronRightIcon}
                  size="x-small"
                  variant="text"
                  density="compact"
                  aria-label={internalOpen.value ? 'Collapse' : 'Expand'}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    toggle()
                  }}
                />
              ),
            }}
          </VTooltip>
          {!internalOpen.value && slots.chip?.()}
          {props.label && <span class={styles.label}>{props.label}</span>}
        </div>
        <VExpandTransition>
          {internalOpen.value && <div>{slots.default?.()}</div>}
        </VExpandTransition>
      </div>
    )
  },
})
