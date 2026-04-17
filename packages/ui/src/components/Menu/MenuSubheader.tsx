import { defineComponent } from 'vue'
import { VListSubheader } from 'vuetify/components'

import styles from './Menu.module.scss'

export const MenuSubheader = defineComponent({
  name: 'MenuSubheader',
  setup(_, { slots }) {
    return () => <VListSubheader class={styles.subheader}>{slots.default?.()}</VListSubheader>
  },
})
