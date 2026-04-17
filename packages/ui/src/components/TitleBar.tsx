import { defineComponent, type SlotsType, type VNode } from 'vue'
import { VCard } from 'vuetify/components'

export const TitleBar = defineComponent({
  name: 'TitleBar',
  props: {
    /** When true, render only the layout shell (no card background/elevation). */
    transparent: { type: Boolean, default: false },
  },
  slots: Object as SlotsType<{
    title: () => VNode[]
    center: () => VNode[]
    actions: () => VNode[]
  }>,
  setup(props, { slots }) {
    const inner = (extraClass: string) => (
      <>
        <div class="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
          {slots.title?.()}
        </div>
        {slots.center && <div class={`d-flex align-center ${extraClass}`}>{slots.center()}</div>}
        <div class={`d-flex align-center ga-2 ${extraClass}`}>{slots.actions?.()}</div>
      </>
    )
    return () => {
      const baseStyle = {
        margin: '8px 8px 0 0',
        height: '48px',
      }
      if (props.transparent) {
        return (
          <div
            class="d-flex align-center px-4 flex-shrink-0"
            style={{ ...baseStyle, background: 'transparent' }}
          >
            {inner('ms-2')}
          </div>
        )
      }
      return (
        <VCard
          class="d-flex align-center px-4 flex-shrink-0"
          style={{ ...baseStyle, borderRadius: '8px' }}
          elevation={2}
        >
          {inner('ms-2')}
        </VCard>
      )
    }
  },
})
