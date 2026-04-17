import { defineComponent } from 'vue'
import { VDivider } from 'vuetify/components'

import styles from './Menu.module.scss'

export const MenuDivider = defineComponent({
  name: 'MenuDivider',
  setup() {
    return () => <VDivider class={styles.divider} />
  },
})
