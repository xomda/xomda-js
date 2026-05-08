import { defineComponent, type SlotsType, type VNode } from 'vue'
import { VCard } from 'vuetify/components'

import { ThemeToggle } from './ThemeToggle'

export const TitleBar = defineComponent({
  name: 'TitleBar',
  slots: Object as SlotsType<{
    title: () => VNode[]
    actions: () => VNode[]
  }>,
  setup(props, { slots }) {
    return () => (
      <VCard
        class="d-flex align-center px-4 flex-shrink-0"
        style={{
          margin: '8px 8px 0 0',
          height: '48px',
          borderRadius: '8px',
        }}
        elevation={2}
      >
        <div class="flex-grow-1 text-truncate">{slots.title?.()}</div>
        <div class="d-flex align-center ga-2 ms-2">
          {slots.actions?.()}
          <ThemeToggle />
        </div>
      </VCard>
    )
  },
})
