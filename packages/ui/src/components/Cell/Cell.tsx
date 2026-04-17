import { AddIcon, ChevronDownIcon, ChevronUpIcon, DeleteIcon, MoreIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType } from 'vue'
import { VBtn, VCard, VMenu } from 'vuetify/components'

import { Menu, type MenuItemConfig } from '../Menu'
import styles from './Cell.module.scss'

export const Cell = defineComponent({
  name: 'Cell',
  props: {
    typeOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    disableMoveUp: { type: Boolean, default: false },
    disableMoveDown: { type: Boolean, default: false },
  },
  emits: {
    delete: () => true,
    moveUp: () => true,
    moveDown: () => true,
    addAbove: () => true,
    addBelow: () => true,
  },
  setup(props, { emit, slots }) {
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
      items.push(
        {
          key: 'move-up',
          title: 'Move up',
          icon: ChevronUpIcon,
          disabled: props.disableMoveUp,
          onClick: () => emit('moveUp'),
        },
        {
          key: 'move-down',
          title: 'Move down',
          icon: ChevronDownIcon,
          disabled: props.disableMoveDown,
          onClick: () => emit('moveDown'),
        },
        { divider: true, key: 'actions-divider' },
        {
          key: 'delete',
          title: 'Delete',
          icon: DeleteIcon,
          color: 'error',
          onClick: () => emit('delete'),
        }
      )
      return items
    })

    return () => {
      const toolbar = slots.toolbar?.()
      const hasToolbar = toolbar != null
      const hasProperties = !!slots.properties

      return (
        <div class={styles.cell}>
          <VBtn
            class={styles.addAbove}
            icon={AddIcon as any}
            size="x-small"
            density="compact"
            variant="tonal"
            aria-label="Add cell above"
            onClick={() => emit('addAbove')}
          />

          <div class={styles.gutter}>
            {/*
            <VBtn
              class={['cell-drag-handle']}
              icon={DragIndicatorIcon as any}
              size="x-small"
              density="comfortable"
              variant="text"
              aria-label="Drag to reorder"
              style={{ cursor: 'grab' }}
            />
*/}
            <VMenu>
              {{
                activator: ({ props: menuProps }: any) => (
                  <VBtn
                    {...menuProps}
                    icon={MoreIcon as any}
                    size="x-small"
                    density="comfortable"
                    variant="text"
                    aria-label="Cell actions"
                  />
                ),
                default: () => (
                  <Menu items={actionItems.value}>
                    {hasProperties ? slots.properties?.() : null}
                  </Menu>
                ),
              }}
            </VMenu>
          </div>

          <VCard class={styles.body} rounded="lg" elevation={0} flat tile color="transparent">
            {hasToolbar && <div class={styles.bodyHeader}>{toolbar}</div>}
            {slots.default?.()}
          </VCard>

          <VBtn
            class={styles.addBelow}
            icon={AddIcon as any}
            size="x-small"
            density="compact"
            variant="tonal"
            aria-label="Add cell below"
            onClick={() => emit('addBelow')}
          />
        </div>
      )
    }
  },
})
