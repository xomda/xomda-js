import { ChevronRightIcon } from '@xomda/icons'
import {
  FileEntryIcon,
  FileEntryListItem,
  MultiIcon,
  type MultiIconEntry,
  useDelayedLoading,
} from '@xomda/ui'
import { defineComponent, type PropType, toRef } from 'vue'
import { VChip, VIcon, VProgressCircular } from 'vuetify/components'

import styles from './FolderTreeNode.module.scss'
import type { FileEntry } from './types'
import { getEntryDisplayProps } from './useFolderEntries'

export const FolderTreeNode = defineComponent({
  name: 'FolderTreeNode',
  props: {
    entry: { type: Object as PropType<FileEntry>, required: true },
    path: { type: String, required: true },
    depth: { type: Number, required: true },
    isExpanded: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
    /** Plugin icons for files; project-kind icons for folders. */
    icons: { type: Array as PropType<MultiIconEntry[] | undefined>, default: undefined },
    onToggle: { type: Function as PropType<(path: string) => void>, required: true },
    onSelectFile: {
      type: Function as PropType<(path: string, entry: FileEntry) => void>,
      required: true,
    },
  },
  setup(props) {
    const showLoading = useDelayedLoading(toRef(props, 'isLoading'))
    return () => {
      const display = getEntryDisplayProps(props.entry, props.icons)

      const handleClick = () => {
        if (props.entry.isDirectory) props.onToggle(props.path)
        else props.onSelectFile(props.path, props.entry)
      }

      return (
        <FileEntryListItem
          name={props.entry.name}
          isDirectory={props.entry.isDirectory}
          active={props.isSelected}
          color={display.color}
          class={display.classList}
          style={{
            ...display.style,
            paddingLeft: `${props.depth * 16 + 8}px`,
          }}
          onClick={handleClick}
        >
          {{
            icon: () => (
              <span class={styles.iconWithChevron}>
                <span class={styles.chevronSlot}>
                  {props.entry.isDirectory ? (
                    showLoading.value ? (
                      <VProgressCircular indeterminate size={12} width={2} color="primary" />
                    ) : (
                      <VIcon
                        icon={ChevronRightIcon}
                        size={16}
                        class={[styles.chevron, props.isExpanded && styles.chevronExpanded]}
                      />
                    )
                  ) : null}
                </span>
                <FileEntryIcon
                  isDirectory={props.entry.isDirectory}
                  icon={display.iconOverlay}
                  color={display.iconColor}
                  primaryIcon={display.filePrimaryIcon}
                  primaryColor={display.filePrimaryColor}
                />
              </span>
            ),
            append: () => {
              // Folders keep the project-kind icon row (file glyph still
              // reads as a folder, so we need the badge). Files use the
              // plugin icon as the primary glyph above and don't need a
              // tacked-on duplicate here.
              const appendIcons = props.entry.isDirectory ? display.projectIcons : []
              return (
                <span class="d-inline-flex align-center ga-1">
                  {appendIcons.length > 0 && <MultiIcon icons={appendIcons} size={14} max={4} />}
                  {props.entry.isGenerated && (
                    <VChip density="compact" size="x-small" color="secondary" label>
                      G
                    </VChip>
                  )}
                </span>
              )
            },
          }}
        </FileEntryListItem>
      )
    }
  },
})
