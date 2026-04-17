import { defineComponent, onBeforeUnmount, onMounted, type PropType, ref, watch } from 'vue'
import { VMenu } from 'vuetify/components'

import { Menu, type MenuItemConfig } from '../Menu'

/**
 * Right-click context menu attached to its parent DOM element.
 *
 * Usage — drop it as a child of the element you want to trigger on:
 *
 *     <div>
 *       <SomeContent />
 *       <ContextMenu items={items} />
 *     </div>
 *
 * The component renders no visible content in the parent; it just hooks a
 * `contextmenu` listener onto its parent element. When the user
 * right-clicks anywhere on that parent (including descendants), the menu
 * opens at the cursor.
 *
 * **Nesting.** A child `<ContextMenu>` placed deeper in the tree calls
 * `event.stopPropagation()` on the contextmenu event before opening, so an
 * outer `<ContextMenu>` higher up will *not* also fire — only the
 * innermost menu pops. The default browser menu is suppressed in all
 * cases (`preventDefault`).
 *
 * `items` may be a static array or a getter, in case the menu shape needs
 * to depend on which descendant was clicked (read `event.target` from the
 * `onOpen` hook for that information).
 */
// Registry of close-callbacks for every mounted ContextMenu. When one
// opens, it closes every other so only a single context surface is ever
// visible (matches native OS context-menu behavior).
const openInstances = new Set<() => void>()

export const ContextMenu = defineComponent({
  name: 'ContextMenu',
  props: {
    items: {
      type: [Array, Function] as PropType<MenuItemConfig[] | (() => MenuItemConfig[])>,
      required: true,
    },
    /** Minimum width of the rendered menu surface. */
    minWidth: { type: [Number, String] as PropType<number | string>, default: 200 },
    /**
     * Disable the listener without unmounting. When true the parent's
     * native context menu is restored.
     */
    disabled: { type: Boolean, default: false },
    /**
     * Called with the original `MouseEvent` just before the menu opens.
     * Use this to capture `event.target` for click-target-aware menu
     * decisions before the menu paints.
     */
    onOpen: { type: Function as PropType<(e: MouseEvent) => void>, default: undefined },
  },
  setup(props) {
    const open = ref(false)
    const x = ref(0)
    const y = ref(0)
    const sentinel = ref<HTMLElement | null>(null)

    const close = () => {
      open.value = false
    }
    openInstances.add(close)
    onBeforeUnmount(() => openInstances.delete(close))

    let attachedTo: HTMLElement | null = null
    const handler = (e: MouseEvent) => {
      if (props.disabled) return
      // preventDefault: swallow the OS context menu.
      // stopPropagation: keep a parent `<ContextMenu>` from also opening.
      e.preventDefault()
      e.stopPropagation()
      // Close any other context menu that's currently open — only one
      // ContextMenu surface should be visible at a time across the page.
      for (const c of openInstances) if (c !== close) c()
      props.onOpen?.(e)
      x.value = e.clientX
      y.value = e.clientY
      // Force a re-open even if the menu was already open at a different
      // point (VMenu reads `target` only on open transition).
      open.value = false
      // Microtask defer so VMenu sees the false→true edge.
      queueMicrotask(() => {
        open.value = true
      })
    }

    const attach = () => {
      detach()
      const parent = sentinel.value?.parentElement ?? null
      if (!parent) return
      parent.addEventListener('contextmenu', handler)
      attachedTo = parent
    }
    const detach = () => {
      if (attachedTo) attachedTo.removeEventListener('contextmenu', handler)
      attachedTo = null
    }

    onMounted(attach)
    onBeforeUnmount(detach)
    // Re-attach if the sentinel reference moves between renders (rare but
    // can happen if the parent component re-keys its subtree).
    watch(sentinel, attach)

    return () => {
      const resolved = typeof props.items === 'function' ? props.items() : props.items
      return (
        <>
          {/* Zero-size anchor for grabbing parentElement on mount. */}
          <span ref={sentinel} style={{ display: 'none' }} aria-hidden="true" />
          <VMenu
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => (open.value = v)}
            target={[x.value, y.value] as [number, number]}
            closeOnContentClick
          >
            <Menu items={resolved} minWidth={props.minWidth} />
          </VMenu>
        </>
      )
    }
  },
})
