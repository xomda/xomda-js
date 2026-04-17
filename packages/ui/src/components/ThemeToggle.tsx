import { DarkModeIcon, LightModeIcon } from '@xomda/icons'
import { defineComponent } from 'vue'
import { VBtn } from 'vuetify/components'

import { useLocalStorageStore } from '../stores/local-storage'

export const ThemeToggle = defineComponent({
  name: 'ThemeToggle',
  setup() {
    const store = useLocalStorageStore()

    function toggleTheme() {
      store.darkMode = !store.darkMode
    }

    return () => (
      <VBtn
        density="comfortable"
        icon={store.darkMode ? LightModeIcon : DarkModeIcon}
        variant="text"
        onClick={toggleTheme}
        class="mr-2"
      />
    )
  },
})
