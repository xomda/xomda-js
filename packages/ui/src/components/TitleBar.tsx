import { defineComponent, type SlotsType, type VNode } from 'vue'
import { VAppBar, VAppBarTitle, VSpacer } from 'vuetify/components'

import { ThemeToggle } from './ThemeToggle'

export const TitleBar = defineComponent({
  name: 'TitleBar',
  slots: Object as SlotsType<{
    title: () => VNode[]
    actions: () => VNode[]
  }>,
  setup(props, { slots }) {
    return () => (
      <VAppBar elevation={0} border="b" height="48">
        <VAppBarTitle>{slots.title?.()}</VAppBarTitle>
        <VSpacer />
        <div class="d-flex align-center ga-2 px-2">
          {slots.actions?.()}
          <ThemeToggle />
        </div>
      </VAppBar>
    )
  },
})
