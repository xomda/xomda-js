import { ChevronRightIcon } from '@xomda/icons'
import { defineComponent, type PropType, type Slots } from 'vue'
import { VList, VMenu } from 'vuetify/components'

import styles from './Menu.module.scss'
import { MenuDivider } from './MenuDivider'
import { type MenuIcon, MenuItem } from './MenuItem'
import { MenuSubheader } from './MenuSubheader'

export type MenuSubmenuConfig = {
  key?: string | number
  title: string
  icon?: MenuIcon
  disabled?: boolean
  submenu: MenuItemConfig[]
  emptyText?: string
  titleSlot?: string
  prependSlot?: string
  checkSlot?: string
  appendSlot?: string
}

export type MenuGroupConfig = {
  group: true
  key?: string | number
  title?: string
  titleSlot?: string
  items: MenuItemConfig[]
}

export type MenuLeafConfig = {
  key?: string | number
  title: string
  subtitle?: string
  icon?: MenuIcon
  appendIcon?: MenuIcon
  shortcut?: string
  color?: string
  disabled?: boolean
  active?: boolean
  checked?: boolean
  titleSlot?: string
  prependSlot?: string
  checkSlot?: string
  appendSlot?: string
  onClick?: (e: MouseEvent) => void
}

export type MenuItemConfig =
  | { divider: true; key?: string | number }
  | { subheader: string; key?: string | number; titleSlot?: string }
  | MenuGroupConfig
  | MenuSubmenuConfig
  | MenuLeafConfig

const isDivider = (i: MenuItemConfig): i is { divider: true; key?: string | number } =>
  'divider' in i && i.divider === true

const isSubheader = (
  i: MenuItemConfig
): i is { subheader: string; key?: string | number; titleSlot?: string } =>
  'subheader' in i && typeof (i as { subheader: unknown }).subheader === 'string'

const isGroup = (i: MenuItemConfig): i is MenuGroupConfig =>
  'group' in i && (i as MenuGroupConfig).group === true

const isSubmenu = (i: MenuItemConfig): i is MenuSubmenuConfig =>
  'submenu' in i && Array.isArray((i as MenuSubmenuConfig).submenu)

const slotContent = (slots: Slots, name: string | undefined): (() => unknown) | undefined => {
  if (!name) return undefined
  const fn = slots[name]
  return fn ? () => fn() : undefined
}

export const Menu = defineComponent({
  name: 'Menu',
  props: {
    items: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    minWidth: { type: [Number, String], default: undefined },
  },
  setup(props, { slots }) {
    const renderItem = (item: MenuItemConfig, index: number): unknown => {
      const key = ('key' in item && item.key !== undefined ? item.key : index) as string | number
      if (isDivider(item)) return <MenuDivider key={`divider-${key}`} />
      if (isSubheader(item)) {
        const titleSlot = slotContent(slots, item.titleSlot)
        return (
          <MenuSubheader key={`subheader-${key}`}>
            {titleSlot ? titleSlot() : item.subheader}
          </MenuSubheader>
        )
      }
      if (isGroup(item)) {
        return (
          <div key={`group-${key}`} class={styles.group}>
            {item.title !== undefined || item.titleSlot ? (
              <MenuSubheader>{slotContent(slots, item.titleSlot)?.() ?? item.title}</MenuSubheader>
            ) : null}
            {item.items.map(renderItem)}
          </div>
        )
      }
      if (isSubmenu(item)) {
        const innerItems: MenuItemConfig[] =
          item.submenu.length === 0
            ? [{ title: item.emptyText ?? '(none)', disabled: true }]
            : item.submenu
        return (
          <VMenu
            key={`submenu-${key}`}
            submenu
            location="end"
            openOnHover
            openOnClick
            openDelay={0}
            closeDelay={150}
            closeOnContentClick
          >
            {{
              activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                <MenuItem
                  {...menuProps}
                  title={item.title}
                  icon={item.icon}
                  appendIcon={ChevronRightIcon}
                  disabled={item.disabled}
                >
                  {{
                    ...(item.prependSlot ? { prepend: slotContent(slots, item.prependSlot)! } : {}),
                    ...(item.checkSlot ? { check: slotContent(slots, item.checkSlot)! } : {}),
                  }}
                </MenuItem>
              ),
              default: () => <Menu items={innerItems}>{slots}</Menu>,
            }}
          </VMenu>
        )
      }
      const leaf = item as MenuLeafConfig
      return (
        <MenuItem
          key={key}
          title={leaf.title}
          subtitle={leaf.subtitle}
          icon={leaf.icon}
          appendIcon={leaf.appendIcon}
          shortcut={leaf.shortcut}
          color={leaf.color}
          disabled={leaf.disabled}
          active={leaf.active}
          checked={leaf.checked}
          onClick={leaf.onClick}
        >
          {{
            ...(leaf.prependSlot ? { prepend: slotContent(slots, leaf.prependSlot)! } : {}),
            ...(leaf.checkSlot ? { check: slotContent(slots, leaf.checkSlot)! } : {}),
            ...(leaf.appendSlot ? { append: slotContent(slots, leaf.appendSlot)! } : {}),
          }}
        </MenuItem>
      )
    }

    return () => {
      const renderedItems = props.items?.map(renderItem)
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
