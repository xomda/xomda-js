import { ChevronRightIcon } from '@xomda/icons'
import { FileEntryIcon, FileEntryListItem } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
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
    onToggle: { type: Function as PropType<(path: string) => void>, required: true },
    onSelectFile: {
      type: Function as PropType<(path: string, entry: FileEntry) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const display = getEntryDisplayProps(props.entry)

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
          class={[display.classList, styles.variables]}
          style={{
            ...display.style,
            paddingLeft: `calc(${props.depth} * var(--v-folder-tree-item-indent))`,
          }}
          onClick={handleClick}
        >
          {{
            icon: () => (
              <span class={styles.iconWithChevron}>
                <span class={styles.chevronSlot}>
                  {props.entry.isDirectory ? (
                    props.isLoading ? (
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
                />
              </span>
            ),
            ...(props.entry.isGenerated
              ? {
                  append: () => (
                    <VChip density="compact" size="x-small" color="secondary" label>
                      G
                    </VChip>
                  ),
                }
              : {}),
          }}
        </FileEntryListItem>
      )
    }
  },
})
