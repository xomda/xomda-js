import { CloseIcon } from '@xomda/icons'
import { FileEntryIcon } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
import { VBtn, VTab, VTabs } from 'vuetify/components'

import type { OpenTemplateTab } from '../useTemplateTabs'
import styles from './TemplateTabs.module.scss'

export const TemplateTabs = defineComponent({
  name: 'TemplateTabs',
  props: {
    tabs: { type: Array as PropType<readonly OpenTemplateTab[]>, required: true },
    activeUuid: { type: String as PropType<string | null>, default: null },
  },
  emits: {
    'update:activeUuid': (_uuid: string) => true,
    close: (_uuid: string) => true,
    contextmenu: (_uuid: string, _event: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const onClose = (e: Event, uuid: string) => {
      // Don't let the tab also receive the click and switch active.
      e.stopPropagation()
      emit('close', uuid)
    }

    const onContextmenu = (e: MouseEvent, uuid: string) => {
      // Preserve native behaviour (preventDefault is the controller's job)
      // and let the parent decide which actions to show. Emitting the
      // event keeps this component declarative and presentational.
      emit('contextmenu', uuid, e)
    }

    return () => (
      <div class={styles.bar}>
        <VTabs
          class={styles.tabs}
          modelValue={props.activeUuid ?? undefined}
          onUpdate:modelValue={(v: unknown) => {
            if (typeof v === 'string') emit('update:activeUuid', v)
          }}
          density="compact"
          hideSlider
          showArrows
        >
          {props.tabs.map((tab) => (
            <VTab
              key={tab.uuid}
              value={tab.uuid}
              slim
              class={['rounded', 'border', 'mr-1']}
              onContextmenu={(e: MouseEvent) => onContextmenu(e, tab.uuid)}
            >
              {{
                default: () => (
                  <span class={styles.tabLabel}>
                    <FileEntryIcon size={16} />
                    <span>{tab.buffer.draft.value?.name ?? ''}</span>
                    {tab.buffer.dirty.value && (
                      <span class={styles.dirtyDot} aria-label="Unsaved changes" role="img" />
                    )}
                  </span>
                ),
                append: () => (
                  <VBtn
                    class={styles.closeBtn}
                    icon={CloseIcon}
                    size="x-small"
                    variant="text"
                    density="comfortable"
                    aria-label="Close tab"
                    onClick={(e: Event) => onClose(e, tab.uuid)}
                  />
                ),
              }}
            </VTab>
          ))}
        </VTabs>
        {slots.append && <div class={styles.append}>{slots.append()}</div>}
      </div>
    )
  },
})
