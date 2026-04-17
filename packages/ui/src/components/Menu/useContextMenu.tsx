import { defineComponent, inject, type InjectionKey, type PropType, provide, ref } from 'vue'
import { VMenu } from 'vuetify/components'

import { Menu, type MenuItemConfig } from './Menu'

export type ContextMenuController = {
  open: (event: MouseEvent, items: MenuItemConfig[]) => void
  close: () => void
}

type ContextMenuState = {
  modelValue: ReturnType<typeof ref<boolean>>
  items: ReturnType<typeof ref<MenuItemConfig[]>>
  x: ReturnType<typeof ref<number>>
  y: ReturnType<typeof ref<number>>
  controller: ContextMenuController
}

const ContextMenuKey: InjectionKey<ContextMenuState> = Symbol('ContextMenu')

const createState = (): ContextMenuState => {
  const modelValue = ref<boolean>(false)
  const items = ref<MenuItemConfig[]>([])
  const x = ref<number>(0)
  const y = ref<number>(0)
  const controller: ContextMenuController = {
    open(event, nextItems) {
      event.preventDefault()
      items.value = nextItems
      x.value = event.clientX
      y.value = event.clientY
      modelValue.value = true
    },
    close() {
      modelValue.value = false
    },
  }
  return { modelValue, items, x, y, controller }
}

export const ContextMenuHost = defineComponent({
  name: 'ContextMenuHost',
  props: {
    minWidth: { type: [Number, String] as PropType<number | string>, default: 200 },
  },
  setup(props) {
    const state = createState()
    provide(ContextMenuKey, state)
    return () => (
      <VMenu
        modelValue={state.modelValue.value}
        onUpdate:modelValue={(v: boolean) => (state.modelValue.value = v)}
        target={[state.x.value, state.y.value] as [number, number]}
        closeOnContentClick
      >
        <Menu items={state.items.value} minWidth={props.minWidth} />
      </VMenu>
    )
  },
})

export const useContextMenu = (): ContextMenuController => {
  const state = inject(ContextMenuKey, null)
  if (!state) {
    throw new Error('useContextMenu requires <ContextMenuHost> to be mounted in the app tree')
  }
  return state.controller
}
