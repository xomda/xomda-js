import './styles/global.scss'

import { ChevronDownIcon } from '@xomda/icons'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export const vuetify = createVuetify({
  defaults: {
    global: {
      size: 'small',
      style: {
        'font-family': 'Mulish Variable, sans-serif',
      },
    },
    VEmptyState: {
      size: 96,
    },
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
          primary: '#1867c0',
        },
      },
    },
  },
})
