import { FolderIcon } from '@xomda/icons'
import type { MultiIconEntry } from '@xomda/ui'
import { defineComponent, type PropType } from 'vue'
import { VEmptyState, VList } from 'vuetify/components'

import { FolderTreeNode } from './FolderTreeNode'
import type { FileEntry, TreeNode } from './types'

export const FolderTreeView = defineComponent({
  name: 'FolderTreeView',
  props: {
    nodes: { type: Array as PropType<TreeNode[]>, required: true },
    selectedPath: { type: String as PropType<string | null>, default: null },
    /** Resolver returning plugin icons for a file (by full path). */
    pluginIconsForPath: {
      type: Function as PropType<(path: string) => MultiIconEntry[] | undefined>,
      default: undefined,
    },
    /** Resolver returning project-kind icons for a folder (by full path). */
    folderProjectIconsForPath: {
      type: Function as PropType<(path: string) => MultiIconEntry[] | undefined>,
      default: undefined,
    },
    onToggle: { type: Function as PropType<(path: string) => void>, required: true },
    onSelectFile: {
      type: Function as PropType<(path: string, entry: FileEntry) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <VList class="overflow-y-auto flex-grow-1" density="compact">
        {props.nodes.map((node) => {
          const icons = node.entry.isDirectory
            ? props.folderProjectIconsForPath?.(node.path)
            : props.pluginIconsForPath?.(node.path)
          return (
            <FolderTreeNode
              key={node.path}
              entry={node.entry}
              path={node.path}
              depth={node.depth}
              isExpanded={node.isExpanded}
              isLoading={node.isLoading}
              isSelected={props.selectedPath === node.path}
              icons={icons}
              onToggle={props.onToggle}
              onSelectFile={props.onSelectFile}
            />
          )
        })}
        {props.nodes.length === 0 && <VEmptyState icon={FolderIcon} title="Empty directory" />}
      </VList>
    )
  },
})
