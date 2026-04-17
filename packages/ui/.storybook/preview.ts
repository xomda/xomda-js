import 'vuetify/styles'

import type { Preview } from '@storybook/vue3'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import type { App } from 'vue'
import { h } from 'vue'
import { createVuetify } from 'vuetify'
import { VApp, VMain } from 'vuetify/components'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

const vuetify = createVuetify({
  defaults: {
    global: {
      size: 'small',
      density: 'comfortable',
    },
    VBtn: { density: 'default' },
    VList: { density: 'compact' },
    VListItem: { density: 'compact' },
    VListSubheader: { density: 'compact' },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: { colors: { background: '#f5f5f5', primary: '#1867c0' } },
      dark: { dark: true, colors: { primary: '#1867c0', surface: '#212226' } },
    },
  },
})

const pinia = createPinia()

setup((app: App) => {
  app.use(vuetify)
  app.use(pinia)
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#f5f5f5' },
        { name: 'white', value: '#ffffff' },
        { name: 'dark', value: '#1a1a2e' },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Vuetify theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, ctx) => {
      vuetify.theme.change(ctx.globals.theme === 'dark' ? 'dark' : 'light')
      return () =>
        h(VApp, null, {
          default: () => h(VMain, { class: 'pa-6' }, { default: () => h(story()) }),
        })
    },
  ],
}

export default preview
