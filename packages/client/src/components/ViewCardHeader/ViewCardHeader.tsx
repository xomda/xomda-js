import { MoreIcon, VisibilityIcon } from '@xomda/icons'
import { MenuButton, type MenuItemConfig } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
import { VSpacer } from 'vuetify/components'

import styles from './ViewCardHeader.module.scss'

export const ViewCardHeader = defineComponent({
  name: 'ViewCardHeader',
  props: {
    viewOptions: { type: Array as PropType<MenuItemConfig[]>, required: true },
    sortItems: { type: Array as PropType<MenuItemConfig[]>, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div class={styles.header}>
        <MenuButton
          icon={VisibilityIcon}
          tooltip="View options"
          items={props.viewOptions}
          size="small"
          density="comfortable"
        />
        <div class={styles.leading}>{slots.leading?.()}</div>
        <VSpacer />
        <div class={styles.actions}>
          {slots.actions?.()}
          <MenuButton
            icon={MoreIcon}
            tooltip="Options"
            items={[{ key: 'sort', title: 'Sort by', submenu: props.sortItems }]}
            size="small"
            density="comfortable"
          />
        </div>
      </div>
    )
  },
})
