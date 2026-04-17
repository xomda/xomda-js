import { ConfirmDialogHost, GlassBackground, useLocalStorageStore } from '@xomda/ui'
import { defineComponent, watch } from 'vue'
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
          <GlassBackground
            intensity={0.2}
            density={0.3}
            opacity={0.3}
            blur={16}
            animationSpeed={2}
          />
          <RouterView />
        </VMain>
        <ConfirmDialogHost />
      </VApp>
    )
  },
})
