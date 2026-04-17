import { ChevronDownIcon, ChevronUpIcon, DeleteIcon, MoreIcon } from '@xomda/icons'
import { defineComponent } from 'vue'
import { VBtn, VCard, VChip, VList, VMenu, VSpacer, VToolbar } from 'vuetify/components'

export const Cell = defineComponent({
  name: 'Cell',
  props: {
    type: { type: String, default: undefined },
    showDelete: { type: Boolean, default: true },
    showMove: { type: Boolean, default: true },
    disableMoveUp: { type: Boolean, default: false },
    disableMoveDown: { type: Boolean, default: false },
  },
  emits: {
    delete: () => true,
    moveUp: () => true,
    moveDown: () => true,
  },
  setup(props, { emit, slots }) {
    return () => {
      const hasProperties = !!slots.properties

      return (
        <VCard rounded="lg" elevation={0} border>
          <VToolbar
            density="compact"
            flat
            color={'transparent'}
            class={['px-2', 'align-center', 'gc-2']}
            height={46}
          >
            {slots['action-prepend']?.()}

            {props.type && (
              <VChip size="x-small" variant="tonal" class="ml-1">
                {props.type}
              </VChip>
            )}

            {slots.toolbar?.()}

            <VSpacer />

            {props.showMove && (
              <>
                <VBtn
                  icon={ChevronUpIcon as any}
                  size="x-small"
                  density={'comfortable'}
                  variant="text"
                  disabled={props.disableMoveUp}
                  onClick={() => emit('moveUp')}
                />
                <VBtn
                  icon={ChevronDownIcon as any}
                  size="x-small"
                  density={'comfortable'}
                  variant="text"
                  disabled={props.disableMoveDown}
                  onClick={() => emit('moveDown')}
                />
              </>
            )}

            {hasProperties && (
              <VMenu>
                {{
                  activator: ({ props: menuProps }: any) => (
                    <VBtn
                      {...menuProps}
                      icon={MoreIcon as any}
                      size="x-small"
                      density={'comfortable'}
                      variant="text"
                    />
                  ),
                  default: () => <VList density="compact">{slots.properties?.()}</VList>,
                }}
              </VMenu>
            )}

            {props.showDelete && (
              <VBtn
                icon={DeleteIcon as any}
                size="x-small"
                density={'comfortable'}
                variant="text"
                color="error"
                onClick={() => emit('delete')}
              />
            )}
          </VToolbar>

          {slots.default?.()}
        </VCard>
      )
    }
  },
})
