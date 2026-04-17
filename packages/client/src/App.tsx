import { useLocalStorageStore } from '@xomda/ui'
import { defineComponent, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { VApp, VMain, VNavigationDrawer } from 'vuetify/components'

import { AppMeta } from './AppMeta'
import { Sidebar } from './components'

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
        <VNavigationDrawer permanent width="60" elevation={0} border="r">
          <Sidebar />
        </VNavigationDrawer>
        <VMain class={['h-screen']}>
          <RouterView />
        </VMain>
      </VApp>
    )
  },
})
