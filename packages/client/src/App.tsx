import { AuroraBackground, ConfirmDialogHost, PromptDialogHost, useLocalStorageStore, } from '@xomda/ui'
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
          <AuroraBackground
            intensity={0.4}
            animationSpeed={0.5}
            opacity={0.3}
            blur={40}
          />
          <RouterView />
        </VMain>
        <ConfirmDialogHost />
        <PromptDialogHost />
      </VApp>
    )
  },
})
