import { ChevronRightIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import { VList, VMenu } from 'vuetify/components'

import styles from './Menu.module.scss'
import { MenuDivider } from './MenuDivider'
import { type MenuIcon, MenuItem } from './MenuItem'
import { MenuSubheader } from './MenuSubheader'

type MenuSubmenuConfig = {
  key?: string | number
  title: string
  icon?: MenuIcon
  disabled?: boolean
  submenu: MenuItemConfig[]
}

export type MenuItemConfig =
  | { divider: true; key?: string | number }
  | { subheader: string; key?: string | number }
  | MenuSubmenuConfig
  | {
      key?: string | number
      title: string
      subtitle?: string
      icon?: MenuIcon
      appendIcon?: MenuIcon
      shortcut?: string
      color?: string
      disabled?: boolean
      active?: boolean
      onClick?: (e: MouseEvent) => void
    }

const isDivider = (i: MenuItemConfig): i is { divider: true; key?: string | number } =>
  'divider' in i && i.divider === true

const isSubheader = (i: MenuItemConfig): i is { subheader: string; key?: string | number } =>
  'subheader' in i && typeof i.subheader === 'string'

const isSubmenu = (i: MenuItemConfig): i is MenuSubmenuConfig =>
  'submenu' in i && Array.isArray((i as MenuSubmenuConfig).submenu)

export const Menu = defineComponent({
  name: 'Menu',
  props: {
    items: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    minWidth: { type: [Number, String], default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      const renderedItems = props.items?.map((item, index) => {
        const key = item.key ?? index
        if (isDivider(item)) return <MenuDivider key={`divider-${key}`} />
        if (isSubheader(item))
          return <MenuSubheader key={`subheader-${key}`}>{item.subheader}</MenuSubheader>
        if (isSubmenu(item))
          return (
            <VMenu key={`submenu-${key}`} submenu location="end" closeOnContentClick>
              {{
                activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                  <MenuItem
                    {...menuProps}
                    title={item.title}
                    icon={item.icon}
                    appendIcon={ChevronRightIcon}
                    disabled={item.disabled}
                  />
                ),
                default: () => <Menu items={item.submenu} />,
              }}
            </VMenu>
          )
        return (
          <MenuItem
            key={key}
            title={item.title}
            subtitle={item.subtitle}
            icon={item.icon}
            appendIcon={item.appendIcon}
            shortcut={item.shortcut}
            color={item.color}
            disabled={item.disabled}
            active={item.active}
            onClick={item.onClick}
          />
        )
      })

      return (
        <VList
          density="compact"
          nav
          class={['xomda-menu', styles.menu]}
          style={
            props.minWidth !== undefined
              ? {
                  minWidth:
                    typeof props.minWidth === 'number' ? `${props.minWidth}px` : props.minWidth,
                }
              : undefined
          }
        >
          {renderedItems}
          {slots.default?.()}
        </VList>
      )
    }
  },
})
