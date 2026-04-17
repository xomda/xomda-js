import { FileEntryListItem } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
import { VChip, VFadeTransition, VList } from 'vuetify/components'

import type { FileEntry } from './types'
import { getEntryDisplayProps } from './useFolderEntries'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export const FolderListView = defineComponent({
  name: 'FolderListView',
  props: {
    entries: { type: Array as PropType<FileEntry[]>, required: true },
    selectedName: { type: String as PropType<string | null>, default: null },
    isLoading: { type: Boolean, default: false },
    showParent: { type: Boolean, default: false },
    onNavigateUp: { type: Function as PropType<() => void>, required: true },
    onSelect: { type: Function as PropType<(entry: FileEntry) => void>, required: true },
  },
  setup(props) {
    return () => (
      <VList class="overflow-y-auto flex-grow-1">
        {props.showParent && (
          <FileEntryListItem
            name=".."
            subtitle="Parent directory"
            isParent
            onClick={props.onNavigateUp}
          />
        )}
        <VFadeTransition hideOnLeave group>
          {props.entries.map((entry) => {
            const display = getEntryDisplayProps(entry)
            return (
              <FileEntryListItem
                key={entry.name}
                name={entry.name}
                subtitle={entry.isDirectory ? 'Directory' : formatSize(entry.size)}
                isDirectory={entry.isDirectory}
                onClick={() => props.onSelect(entry)}
                active={props.selectedName === entry.name && !entry.isDirectory}
                color={display.color}
                iconOverlay={display.iconOverlay}
                iconColor={display.iconColor}
                class={display.classList}
                style={display.style}
              >
                {{
                  append: () =>
                    entry.isGenerated ? (
                      <VChip density="compact" size="x-small" color="secondary" label>
                        G
                      </VChip>
                    ) : null,
                }}
              </FileEntryListItem>
            )
          })}
        </VFadeTransition>
        {props.entries.length === 0 && !props.isLoading && (
          <div class="pa-4 text-center text-caption text-disabled">Empty directory</div>
        )}
      </VList>
    )
  },
})
