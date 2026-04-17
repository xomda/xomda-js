import { FolderIcon } from '@xomda/icons'
import { FileEntryListItem, MultiIcon, type MultiIconEntry } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
import { VChip, VEmptyState, VFadeTransition, VList } from 'vuetify/components'

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
    /** Resolver returning plugin icons for an entry name (relative to the
     *  current folder). Undefined or empty array → no plugin icons. */
    pluginIconsFor: {
      type: Function as PropType<(name: string) => MultiIconEntry[] | undefined>,
      default: undefined,
    },
    /** Resolver returning project-kind icons for a folder entry. */
    folderProjectIconsFor: {
      type: Function as PropType<(name: string) => MultiIconEntry[] | undefined>,
      default: undefined,
    },
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
            const projectIcons = entry.isDirectory
              ? props.folderProjectIconsFor?.(entry.name)
              : undefined
            const display = getEntryDisplayProps(entry, projectIcons)
            const appendIcons = entry.isDirectory
              ? display.projectIcons
              : (props.pluginIconsFor?.(entry.name) ?? [])
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
                  append: () => (
                    <span class="d-inline-flex align-center ga-1">
                      {appendIcons.length > 0 && (
                        <MultiIcon icons={appendIcons} size={14} max={4} />
                      )}
                      {entry.isGenerated && (
                        <VChip density="compact" size="x-small" color="secondary" label>
                          G
                        </VChip>
                      )}
                    </span>
                  ),
                }}
              </FileEntryListItem>
            )
          })}
        </VFadeTransition>
        {props.entries.length === 0 && !props.isLoading && (
          <VEmptyState icon={FolderIcon} title="Empty directory" />
        )}
      </VList>
    )
  },
})
