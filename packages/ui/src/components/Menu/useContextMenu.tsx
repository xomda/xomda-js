import { defineComponent, type PropType, ref } from 'vue'
import { VMenu } from 'vuetify/components'

import { Menu, type MenuItemConfig } from './Menu'

export type ContextMenuController = {
  open: (event: MouseEvent, items: MenuItemConfig[]) => void
  close: () => void
}

// Module-level singleton state, mirroring useConfirm / usePrompt /
// useUnsavedChangesPrompt. Vue provide/inject would only flow from
// ancestor to descendant — that's brittle when the host lives next to
// <RouterView> rather than wrapping it. A module singleton is location-
// independent: mount the host anywhere in the tree, call useContextMenu()
// from anywhere, and the two find each other.
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

export const ContextMenuHost = defineComponent({
  name: 'ContextMenuHost',
  props: {
    minWidth: { type: [Number, String] as PropType<number | string>, default: 200 },
  },
  setup(props) {
    return () => (
      <VMenu
        modelValue={modelValue.value}
        onUpdate:modelValue={(v: boolean) => (modelValue.value = v)}
        target={[x.value, y.value] as [number, number]}
        closeOnContentClick
      >
        <Menu items={items.value} minWidth={props.minWidth} />
      </VMenu>
    )
  },
})

export const useContextMenu = (): ContextMenuController => controller
