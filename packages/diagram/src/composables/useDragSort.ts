import type { Ref } from 'vue'
import { ref } from 'vue'

export interface DragSortItem {
  id: string
}

export interface UseDragSortReturn {
  draggingId: Ref<string | null>
  dragOverId: Ref<string | null>
  onItemDragStart(e: DragEvent, item: DragSortItem): void
  onItemDragEnd(): void
  onItemDragOver(e: DragEvent, item: DragSortItem): void
  onItemDragLeave(e?: DragEvent): void
  /** Returns the reordered id array, or null if no valid reorder occurred. Resets drag state. */
  onItemDrop(e: DragEvent, target: DragSortItem, all: DragSortItem[]): string[] | null
}

export function useDragSort(): UseDragSortReturn {
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  // All listeners stopPropagation so the row's drag events never reach an
  // outer drop zone (e.g. the enclosing Package's `useDropZone`). If they
  // bubble up, that zone's `dragover` overrides `dropEffect = 'none'` for
  // unhandled mime types — Chrome then rejects the drop and the item snaps
  // back, even though the row's own `dragover` set `dropEffect = 'move'`.
  function onItemDragStart(e: DragEvent, item: DragSortItem) {
    e.stopPropagation()
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
    e.stopPropagation()
    if (draggingId.value === item.id) return
    dragOverId.value = item.id
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function onItemDragLeave(e?: DragEvent) {
    e?.stopPropagation()
    dragOverId.value = null
  }

  function onItemDrop(e: DragEvent, target: DragSortItem, all: DragSortItem[]): string[] | null {
    e.preventDefault()
    e.stopPropagation()
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

  return {
    draggingId,
    dragOverId,
    onItemDragStart,
    onItemDragEnd,
    onItemDragOver,
    onItemDragLeave,
    onItemDrop,
  }
}
