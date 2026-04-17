import { TitleBar } from '@xomda/ui'
import { defineComponent, type SlotsType, type VNode } from 'vue'

import { AppSearch } from './AppSearch'

export const AppTitleBar = defineComponent({
  name: 'AppTitleBar',
  props: {
    /** When true, render the bar without card chrome — used by HomeView so the
     *  search keeps its position even though no top bar is visible. */
    transparent: { type: Boolean, default: false },
  },
  slots: Object as SlotsType<{
    title: () => VNode[]
    actions: () => VNode[]
  }>,
  setup(props, { slots }) {
    return () => (
      <TitleBar transparent={props.transparent}>
        {{
          title: slots.title,
          // AppSearch is the rightmost element so its position doesn't shift
          // when view-specific action buttons appear/disappear.
          actions: () => (
            <>
              {slots.actions?.()}
              <AppSearch />
            </>
          ),
        }}
      </TitleBar>
    )
  },
})
