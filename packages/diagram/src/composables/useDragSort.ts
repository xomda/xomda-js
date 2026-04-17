import { ref } from 'vue'
import type { Ref } from 'vue'

export interface DragSortItem {
  id: string
}

export interface UseDragSortReturn {
  draggingId: Ref<string | null>
  dragOverId: Ref<string | null>
  onItemDragStart(e: DragEvent, item: DragSortItem): void
  onItemDragEnd(): void
  onItemDragOver(e: DragEvent, item: DragSortItem): void
  onItemDragLeave(): void
  /** Returns the reordered id array, or null if no valid reorder occurred. Resets drag state. */
  onItemDrop(e: DragEvent, target: DragSortItem, all: DragSortItem[]): string[] | null
}

export function useDragSort(): UseDragSortReturn {
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function onItemDragStart(e: DragEvent, item: DragSortItem) {
    draggingId.value = item.id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', item.id)
    }
  }

  function onItemDragEnd() {
    draggingId.value = null
    dragOverId.value = null
  }

  function onItemDragOver(e: DragEvent, item: DragSortItem) {
    e.preventDefault()
    if (draggingId.value === item.id) return
    dragOverId.value = item.id
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function onItemDragLeave() {
    dragOverId.value = null
  }

  function onItemDrop(e: DragEvent, target: DragSortItem, all: DragSortItem[]): string[] | null {
    e.preventDefault()
    const sourceId = draggingId.value
    if (!sourceId || sourceId === target.id) {
      onItemDragEnd()
      return null
    }

    const ids = all.map((i) => i.id)
    const fromIndex = ids.indexOf(sourceId)
    const toIndex = ids.indexOf(target.id)

    if (fromIndex === -1 || toIndex === -1) {
      onItemDragEnd()
      return null
    }

    ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, sourceId)
    onItemDragEnd()
    return ids
  }

  return { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop }
}
