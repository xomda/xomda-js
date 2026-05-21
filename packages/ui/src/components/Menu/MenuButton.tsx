import { ChevronDownIcon, MoreIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref } from 'vue'
import type { Anchor } from 'vuetify'
import { VBtn, VMenu, VTooltip } from 'vuetify/components'

type Density = 'default' | 'comfortable' | 'compact'

import { Menu, type MenuItemConfig } from './Menu'
import styles from './Menu.module.scss'
import type { MenuIcon } from './MenuItem'

export const MenuButton = defineComponent({
  name: 'MenuButton',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    /**
     * Icon-only button when no `label`. Defaults to MoreIcon — the
     * canonical overflow trigger.
     */
    icon: { type: [String, Object, Function] as PropType<MenuIcon>, default: MoreIcon },
    /**
     * When set, render a labelled (text) button with `label` as its visible
     * caption and a chevron append-icon. Used by the title-bar workspace
     * selector and any future "label + dropdown" affordance.
     */
    label: { type: String, default: undefined },
    /**
     * Append-icon override. Defaults to `ChevronDownIcon` when `label` is
     * set, otherwise `undefined` (icon-only buttons don't show a chevron).
     */
    appendIcon: {
      type: [String, Object, Function] as PropType<MenuIcon>,
      default: undefined,
    },
    tooltip: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
    size: { type: String, default: 'small' },
    density: { type: String as PropType<Density>, default: 'comfortable' },
    variant: { type: String, default: 'text' },
    color: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    // Default: `bottom` — anchor under the activator, let Vuetify's flip
    // middleware pick the horizontal alignment that fits the viewport. The
    // old default (`bottom end`) collapses the menu to the LEFT of the
    // activator, which clips when the button sits near the right edge of a
    // narrow left-side panel. Override per-usage when you need it pinned to
    // a specific corner (e.g. `bottom end` for a title-bar overflow menu
    // near the page's right edge).
    location: { type: String as PropType<Anchor>, default: 'bottom' },
    minWidth: { type: [Number, String], default: undefined },
    modelValue: { type: Boolean, default: undefined },
  },
  emits: {
    // Real validator (returns true to allow the emit). Vue 3's object-syntax
    // emits typing flows from the function signature, so `_value: boolean`
    // pins the payload type for callers without the `null as unknown as ...`
    // smuggle cast.
    'update:modelValue': (_value: boolean) => true,
  },
  setup(props, { emit, attrs, slots }) {
    const internalOpen = ref(false)
    const isControlled = () => props.modelValue !== undefined
    const open = () => (isControlled() ? !!props.modelValue : internalOpen.value)
    const setOpen = (v: boolean) => {
      if (isControlled()) emit('update:modelValue', v)
      else internalOpen.value = v
    }

    return () => {
      const labelled = props.label !== undefined
      const accessibleName = props.ariaLabel ?? props.tooltip ?? props.label ?? 'Menu'
      const appendIcon: MenuIcon | undefined = labelled
        ? (props.appendIcon ?? ChevronDownIcon)
        : props.appendIcon
      // Caption-style button props: no `icon` prop when labelled (icon and
      // label are mutually exclusive in Vuetify's VBtn).
      const renderActivator = (
        menuProps: Record<string, unknown>,
        tipProps: Record<string, unknown> = {}
      ) =>
        labelled ? (
          <VBtn
            {...menuProps}
            {...tipProps}
            {...attrs}
            size={props.size}
            density={props.density}
            variant={props.variant as 'text'}
            color={props.color}
            disabled={props.disabled}
            appendIcon={appendIcon as string}
            aria-label={accessibleName}
            onClick={(e: Event) => e.stopPropagation()}
          >
            {props.label}
          </VBtn>
        ) : (
          <VBtn
            {...menuProps}
            {...tipProps}
            {...attrs}
            icon={props.icon as string}
            size={props.size}
            density={props.density}
            variant={props.variant as 'text'}
            color={props.color}
            disabled={props.disabled}
            aria-label={accessibleName}
            onClick={(e: Event) => e.stopPropagation()}
          />
        )
      const activatorWrap = labelled ? styles.labeledHover : undefined
      return (
        <VMenu
          modelValue={open()}
          onUpdate:modelValue={(v: boolean) => setOpen(v)}
          location={props.location}
          closeOnContentClick
        >
          {{
            activator: ({ props: menuProps }: { props: Record<string, unknown> }) =>
              props.tooltip ? (
                <VTooltip text={props.tooltip} location="bottom" disabled={open()}>
                  {{
                    activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                      <span class={activatorWrap}>{renderActivator(menuProps, tipProps)}</span>
                    ),
                  }}
                </VTooltip>
              ) : (
                <span class={activatorWrap}>{renderActivator(menuProps)}</span>
              ),
            default: () => (
              <Menu items={props.items} minWidth={props.minWidth}>
                {slots}
              </Menu>
            ),
          }}
        </VMenu>
      )
    }
  },
})
