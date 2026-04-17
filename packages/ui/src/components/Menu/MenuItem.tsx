import { defineComponent, type PropType } from 'vue'
import { VListItem } from 'vuetify/components'

import styles from './Menu.module.scss'

export type MenuIcon = string | object | (new () => unknown)

export const MenuItem = defineComponent({
  name: 'MenuItem',
  inheritAttrs: false,
  props: {
    title: { type: String, default: undefined },
    subtitle: { type: String, default: undefined },
    icon: { type: [String, Object, Function] as PropType<MenuIcon>, default: undefined },
    appendIcon: { type: [String, Object, Function] as PropType<MenuIcon>, default: undefined },
    shortcut: { type: String, default: undefined },
    color: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
  },
  setup(props, { attrs, slots }) {
    return () => (
      <VListItem
        class={['xomda-menu-item']}
        {...attrs}
        title={props.title}
        subtitle={props.subtitle}
        prependIcon={props.icon as any}
        appendIcon={(props.appendIcon && !props.shortcut ? props.appendIcon : undefined) as any}
        color={props.color}
        disabled={props.disabled}
        active={props.active}
        prependGap={8}
      >
        {{
          ...(slots.prepend ? { prepend: slots.prepend } : {}),
          ...(slots.default ? { default: slots.default } : {}),
          ...(slots.append || props.shortcut
            ? {
                append: () =>
                  slots.append?.() ??
                  (props.shortcut ? <span class={styles.shortcut}>{props.shortcut}</span> : null),
              }
            : {}),
        }}
      </VListItem>
    )
  },
})
