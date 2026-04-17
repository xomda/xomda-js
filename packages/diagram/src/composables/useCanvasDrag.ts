import { ref } from 'vue'

const draggingId = ref<string | null>(null)
const dropTargetPackageId = ref<string | null>(null)

export interface CanvasDragState {
  draggingId: typeof draggingId
  dropTargetPackageId: typeof dropTargetPackageId
  start(id: string): void
  setDropTarget(id: string | null): void
  end(): void
}

export function useCanvasDrag(): CanvasDragState {
  return {
    draggingId,
    dropTargetPackageId,
    start(id: string) {
      draggingId.value = id
      dropTargetPackageId.value = null
    },
    setDropTarget(id: string | null) {
      dropTargetPackageId.value = id
    },
    end() {
      draggingId.value = null
      dropTargetPackageId.value = null
    },
  }
}

/**
 * Hit-test the topmost package under the pointer, skipping descendants of
 * the dragging element and (optionally) the current parent.
 *
 * Returns the package id of a "cross-package" target candidate, or null when
 * the cursor is over the current parent, the dragging item itself, empty
 * canvas, or descendants of the dragging item.
 */
export function findDropTarget(
  clientX: number,
  clientY: number,
  draggingEl: HTMLElement,
  currentParentId: string | undefined
): string | null {
  const els = document.elementsFromPoint(clientX, clientY)
  for (const el of els) {
    if (draggingEl.contains(el)) continue
    const pkgEl = (el as HTMLElement).closest('[data-package-id]') as HTMLElement | null
    if (!pkgEl) continue
    if (draggingEl.contains(pkgEl)) continue
    const id = pkgEl.dataset.packageId
    if (!id) continue
    return id === currentParentId ? null : id
  }
  return null
}
