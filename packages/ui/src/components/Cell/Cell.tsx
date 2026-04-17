import { AddIcon, ChevronDownIcon, ChevronUpIcon, DeleteIcon, MoreIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { VBtn, VCard, VTooltip } from 'vuetify/components'

import { MenuButton, type MenuItemConfig } from '../Menu'
import styles from './Cell.module.scss'

export const Cell = defineComponent({
  name: 'Cell',
  props: {
    typeOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    disableMoveUp: { type: Boolean, default: false },
    disableMoveDown: { type: Boolean, default: false },
    /** When true, hide the gutter's up/down buttons and surface them as menu items instead. */
    collapsed: { type: Boolean, default: false },
    /** When provided, the "+" button above the cell shows these as a menu instead of emitting addAbove. */
    addAboveOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    /** When provided, the "+" button below the cell shows these as a menu instead of emitting addBelow. */
    addBelowOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
  },
  emits: {
    delete: () => true,
    moveUp: () => true,
    moveDown: () => true,
    addAbove: () => true,
    addBelow: () => true,
  },
  setup(props, { emit, slots }) {
    const actionsMenuOpen = ref(false)
    const addAboveMenuOpen = ref(false)
    const addBelowMenuOpen = ref(false)
    const anyMenuOpen = computed(
      () => actionsMenuOpen.value || addAboveMenuOpen.value || addBelowMenuOpen.value
    )

    const actionItems = computed<MenuItemConfig[]>(() => {
      const items: MenuItemConfig[] = []
      const typeOptions = props.typeOptions
      if (typeOptions && typeOptions.length > 0) {
        items.push({
          key: 'cell-type',
          title: 'Cell type',
          submenu: typeOptions,
        })
        items.push({ divider: true, key: 'type-divider' })
      }
      if (props.collapsed) {
        items.push({
          key: 'move-up',
          title: 'Move up',
          icon: ChevronUpIcon,
          disabled: props.disableMoveUp,
          onClick: () => emit('moveUp'),
        })
        items.push({
          key: 'move-down',
          title: 'Move down',
          icon: ChevronDownIcon,
          disabled: props.disableMoveDown,
          onClick: () => emit('moveDown'),
        })
        items.push({ divider: true, key: 'move-divider' })
      }
      items.push({
        key: 'delete',
        title: 'Delete',
        icon: DeleteIcon,
        color: 'error',
        onClick: () => emit('delete'),
      })
      return items
    })

    return () => {
      const toolbar = slots.toolbar?.()
      const hasToolbar = toolbar != null
      const hasProperties = !!slots.properties

      const addAboveOptions = props.addAboveOptions
      const addBelowOptions = props.addBelowOptions

      return (
        <div class={[styles.cell, 'xomda-cell', anyMenuOpen.value && styles.menuOpen]}>
          {addAboveOptions && addAboveOptions.length > 0 ? (
            <MenuButton
              modelValue={addAboveMenuOpen.value}
              onUpdate:modelValue={(v: boolean) => (addAboveMenuOpen.value = v)}
              icon={AddIcon}
              tooltip="Add cell above"
              size="x-small"
              density="compact"
              variant="tonal"
              items={addAboveOptions}
              class={[styles.addAbove, 'xomda-cell-add-above']}
            />
          ) : (
            <VTooltip text="Add cell above" location="top">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VBtn
                    {...tipProps}
                    class={[styles.addAbove, 'xomda-cell-add-above']}
                    icon={AddIcon}
                    size="x-small"
                    density="compact"
                    variant="tonal"
                    aria-label="Add cell above"
                    onClick={() => emit('addAbove')}
                  />
                ),
              }}
            </VTooltip>
          )}

          <div class={styles.gutter}>
            <MenuButton
              modelValue={actionsMenuOpen.value}
              onUpdate:modelValue={(v: boolean) => (actionsMenuOpen.value = v)}
              icon={MoreIcon}
              ariaLabel="Cell actions"
              size="x-small"
              density="comfortable"
              variant="text"
              items={actionItems.value}
            >
              {hasProperties ? slots.properties?.() : null}
            </MenuButton>
            {!props.collapsed && (
              <>
                <VTooltip text="Move up" location="right">
                  {{
                    activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                      <VBtn
                        {...tipProps}
                        icon={ChevronUpIcon}
                        size="x-small"
                        density="comfortable"
                        variant="text"
                        aria-label="Move cell up"
                        disabled={props.disableMoveUp}
                        onClick={() => emit('moveUp')}
                      />
                    ),
                  }}
                </VTooltip>
                <VTooltip text="Move down" location="right">
                  {{
                    activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                      <VBtn
                        {...tipProps}
                        icon={ChevronDownIcon}
                        size="x-small"
                        density="comfortable"
                        variant="text"
                        aria-label="Move cell down"
                        disabled={props.disableMoveDown}
                        onClick={() => emit('moveDown')}
                      />
                    ),
                  }}
                </VTooltip>
              </>
            )}
          </div>

          <VCard class={styles.body} rounded="lg" elevation={0} flat tile color="transparent">
            {hasToolbar && <div class={styles.bodyHeader}>{toolbar}</div>}
            {slots.default?.()}
          </VCard>

          {addBelowOptions && addBelowOptions.length > 0 ? (
            <MenuButton
              modelValue={addBelowMenuOpen.value}
              onUpdate:modelValue={(v: boolean) => (addBelowMenuOpen.value = v)}
              icon={AddIcon}
              tooltip="Add cell below"
              size="x-small"
              density="compact"
              variant="tonal"
              items={addBelowOptions}
              class={[styles.addBelow, 'xomda-cell-add-below']}
            />
          ) : (
            <VTooltip text="Add cell below" location="bottom">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VBtn
                    {...tipProps}
                    class={[styles.addBelow, 'xomda-cell-add-below']}
                    icon={AddIcon}
                    size="x-small"
                    density="compact"
                    variant="tonal"
                    aria-label="Add cell below"
                    onClick={() => emit('addBelow')}
                  />
                ),
              }}
            </VTooltip>
          )}
        </div>
      )
    }
  },
})
