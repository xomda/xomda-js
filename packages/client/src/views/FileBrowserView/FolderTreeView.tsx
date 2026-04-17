import { defineComponent, type PropType } from 'vue'
import { VList } from 'vuetify/components'

import { FolderTreeNode } from './FolderTreeNode'
import type { FileEntry, TreeNode } from './types'

export const FolderTreeView = defineComponent({
  name: 'FolderTreeView',
  props: {
    nodes: { type: Array as PropType<TreeNode[]>, required: true },
    selectedPath: { type: String as PropType<string | null>, default: null },
    onToggle: { type: Function as PropType<(path: string) => void>, required: true },
    onSelectFile: {
      type: Function as PropType<(path: string, entry: FileEntry) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <VList class="overflow-y-auto flex-grow-1" density="compact">
        {props.nodes.map((node) => (
          <FolderTreeNode
            key={node.path}
            entry={node.entry}
            path={node.path}
            depth={node.depth}
            isExpanded={node.isExpanded}
            isLoading={node.isLoading}
            isSelected={props.selectedPath === node.path}
            onToggle={props.onToggle}
            onSelectFile={props.onSelectFile}
          />
        ))}
        {props.nodes.length === 0 && (
          <div class="pa-4 text-center text-caption text-disabled">Empty</div>
        )}
      </VList>
    )
  },
})
