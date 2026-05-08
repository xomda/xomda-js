import './styles/global.scss'

import { ChevronDownIcon } from '@xomda/icons'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  defaults: {
    global: {
      size: 'small',
      density: 'comfortable',
      style: {
        'font-family': 'Mulish Variable, sans-serif',
      },
    },
    // Buttons: small size with default density (comfortable + small = too tight)
    VBtn: { density: 'default' },
    // Components without a `size` prop use compact density
    VList: { density: 'compact' },
    VListItem: { density: 'compact' },
    VListSubheader: { density: 'compact' },
    VEmptyState: { size: 96 },
  },
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      dropdown: ChevronDownIcon,
    },
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          background: '#f5f5f5',
          primary: '#1867c0',
        },
      },
    },
  },
})
