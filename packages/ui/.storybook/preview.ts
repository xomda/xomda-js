import 'vuetify/styles'

import type { Preview } from '@storybook/vue3'
import { setup } from '@storybook/vue3'
import { createPinia } from 'pinia'
import type { App } from 'vue'
import { h } from 'vue'
import { createVuetify } from 'vuetify'
import { VApp, VMain, VThemeProvider } from 'vuetify/components'
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
  // Enable autodocs globally — every story's component meta gets a
  // generated Docs page (examples + API table + description) without
  // having to opt-in per-file. Individual stories can still opt out
  // with `tags: ['!autodocs']` on their meta.
  tags: ['autodocs'],
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
          { value: 'side-by-side', title: 'Light & Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (story, ctx) => {
      const mode = ctx.globals.theme
      // Single VApp at the root so VOverlay's teleport target exists.
      // For 'side-by-side' we render the story twice inside two
      // VThemeProvider subtrees — one light, one dark — so the same
      // component can be visually compared across themes simultaneously.
      vuetify.theme.change(mode === 'dark' ? 'dark' : 'light')
      // Each pane must completely fill its grid cell (width + height) so
      // VThemeProvider's `withBackground` paints a hard 50/50 split with
      // no gap. `overflow:auto` keeps wide content (HexView) scrollable
      // inside its column instead of pushing the layout.
      const pane = (theme: 'light' | 'dark') =>
        h(
          VThemeProvider,
          {
            theme,
            withBackground: true,
            style: 'width:100%;height:100%;overflow:auto;',
          },
          {
            // `width:fit-content` makes the inner wrapper shrink to the
            // story's natural size so it doesn't get stretched by the
            // 50/50 grid cell — the pane is just a themed surface
            // around the component, not a frame the component fills.
            default: () =>
              h('div', { class: 'pa-6', style: 'width:fit-content;max-width:100%;' }, [h(story())]),
          }
        )
      return () =>
        h(VApp, null, {
          default: () =>
            h(VMain, null, {
              default: () =>
                mode === 'side-by-side'
                  ? // `position:fixed; inset:0` escapes Storybook's
                    // canvas padding (`layout: 'padded'`) so the split
                    // reaches every edge of the iframe — no white
                    // border around the dark pane.
                    h(
                      'div',
                      {
                        style: 'position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr;',
                      },
                      [pane('light'), pane('dark')]
                    )
                  : h('div', { class: 'pa-6' }, [h(story())]),
            }),
        })
    },
  ],
}

export default preview
