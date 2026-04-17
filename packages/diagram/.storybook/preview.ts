import 'vuetify/styles'

import type { Preview } from '@storybook/vue3'
import { setup } from '@storybook/vue3'
import type { App } from 'vue'
import { h } from 'vue'
import { createVuetify } from 'vuetify'

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: { colors: { background: '#f0f2f5', primary: '#1867c0' } },
      dark: { dark: true, colors: { primary: '#1867c0', surface: '#212226' } },
    },
  },
})

setup((app: App) => {
  app.use(vuetify)
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
        { name: 'canvas', value: '#f0f2f5' },
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
      return () => h(story())
    },
  ],
}

export default preview
