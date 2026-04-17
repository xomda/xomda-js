import { CANVAS_ZOOM_KEY } from '@xomda/diagram'
import {
  AuroraBackground,
  ConfirmDialogHost,
  NotificationHost,
  PromptDialogHost,
  useLocalStorageStore,
} from '@xomda/ui'
import { defineComponent, provide, toRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { VApp, VMain } from 'vuetify/components'

import { AppMeta } from './AppMeta'
import { AppNav } from './components'

export const App = defineComponent({
  name: 'App',
  setup() {
    const theme = useTheme()
    const store = useLocalStorageStore()

    // Single source of truth for the diagram canvas zoom: the preferences
    // store. The diagram package injects via CANVAS_ZOOM_KEY so it never
    // touches localStorage itself (which would race with this store).
    provide(CANVAS_ZOOM_KEY, toRef(store, 'diagramZoom'))

    watch(
      () => store.darkMode,
      (val) => theme.change(val ? 'dark' : 'light'),
      { immediate: true }
    )

    return () => (
      <VApp>
        <AppMeta />
        <AppNav />
        <VMain
          class={['h-screen']}
          style={{
            paddingLeft: 'calc(var(--appnav-width, 56px) + 16px)',
            position: 'relative',
            isolation: 'isolate',
          }}
        >
          <AuroraBackground intensity={0.4} animationSpeed={0.5} opacity={0.3} blur={40} />
          <RouterView />
        </VMain>
        <ConfirmDialogHost />
        <PromptDialogHost />
        <NotificationHost />
      </VApp>
    )
  },
})
