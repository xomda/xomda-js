import { MoreIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref } from 'vue'
import type { Anchor } from 'vuetify'
import { VBtn, VMenu, VTooltip } from 'vuetify/components'

type Density = 'default' | 'comfortable' | 'compact'

import { Menu, type MenuItemConfig } from './Menu'
import type { MenuIcon } from './MenuItem'

export const MenuButton = defineComponent({
  name: 'MenuButton',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    icon: { type: [String, Object, Function] as PropType<MenuIcon>, default: MoreIcon },
    tooltip: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
    size: { type: String, default: 'small' },
    density: { type: String as PropType<Density>, default: 'comfortable' },
    variant: { type: String, default: 'text' },
    color: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    location: { type: String as PropType<Anchor>, default: 'bottom end' },
    minWidth: { type: [Number, String], default: undefined },
    modelValue: { type: Boolean, default: undefined },
  },
  emits: {
    'update:modelValue': null as unknown as (value: boolean) => true,
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
      const label = props.ariaLabel ?? props.tooltip ?? 'Menu'
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
                        aria-label={label}
                        onClick={(e: Event) => e.stopPropagation()}
                      />
                    ),
                  }}
                </VTooltip>
              ) : (
                <VBtn
                  {...menuProps}
                  {...attrs}
                  icon={props.icon as string}
                  size={props.size}
                  density={props.density}
                  variant={props.variant as 'text'}
                  color={props.color}
                  disabled={props.disabled}
                  aria-label={label}
                  onClick={(e: Event) => e.stopPropagation()}
                />
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
