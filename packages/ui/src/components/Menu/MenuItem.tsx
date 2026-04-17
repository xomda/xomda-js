import { CheckIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import type { JSXComponent } from 'vuetify'
import { VHotkey, VIcon, VListItem } from 'vuetify/components'

import styles from './Menu.module.scss'

export type MenuIcon = string | JSXComponent

export type MenuCheckSlotProps = { checked: boolean }

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
    // Tri-state checked: undefined = no column, false = empty column, true = check icon.
    checked: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const hasClickHandler = typeof attrs.onClick === 'function'
      const hasCheckColumn = props.checked !== undefined
      const renderCheck = () => {
        const slotResult = slots.check?.({ checked: !!props.checked } satisfies MenuCheckSlotProps)
        if (slotResult) return slotResult
        if (props.checked === true) return <VIcon icon={CheckIcon} size={16} />
        return <span class={styles.checkPlaceholder} />
      }

      const renderPrepend = () => {
        if (slots.prepend) return slots.prepend()
        if (props.icon) return <VIcon icon={props.icon as string} />
        return null
      }

      const hasPrependContent = !!(slots.prepend || props.icon)

      return (
        <VListItem
          class={['xomda-menu-item', !hasClickHandler && styles.inert]}
          {...attrs}
          link={hasClickHandler ? undefined : false}
          title={props.title}
          subtitle={props.subtitle}
          color={props.color}
          disabled={props.disabled}
          active={props.active}
        >
          {{
            ...(hasCheckColumn || hasPrependContent
              ? {
                  prepend: () => (
                    <span class={styles.prependCluster}>
                      {hasCheckColumn ? (
                        <span class={styles.checkSlot}>{renderCheck()}</span>
                      ) : null}
                      {hasPrependContent ? (
                        <span class={styles.iconSlot}>{renderPrepend()}</span>
                      ) : null}
                    </span>
                  ),
                }
              : {}),
            ...(slots.default ? { default: slots.default } : {}),
            ...(slots.append || props.shortcut || (props.appendIcon && !props.shortcut)
              ? {
                  append: () => {
                    if (slots.append) return slots.append()
                    if (props.shortcut)
                      return <VHotkey keys={props.shortcut} class={styles.shortcut} />
                    if (props.appendIcon) return <VIcon icon={props.appendIcon as string} />
                    return null
                  },
                }
              : {}),
          }}
        </VListItem>
      )
    }
  },
})
