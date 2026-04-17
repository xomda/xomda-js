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
 * the dragging element and the current parent.
 *
 * Returns null while the pointer is still inside the current parent's
 * bounding rect — items only "leave" when dragged outside the parent. When
 * outside, walks the element stack so an outer ancestor package can become
 * the drop target even when the pointer is over empty canvas adjacent to it.
 */
export function findDropTarget(
  clientX: number,
  clientY: number,
  draggingEl: HTMLElement,
  currentParentId: string | undefined
): string | null {
  // Stay-in-parent guard: while the cursor is within the current parent
  // package's bounds, the item is not "leaving" the package.
  if (currentParentId) {
    const parentEl = document.querySelector(
      `[data-package-id="${CSS.escape(currentParentId)}"]`
    ) as HTMLElement | null
    if (parentEl) {
      const r = parentEl.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return null
      }
    }
  }

  const els = document.elementsFromPoint(clientX, clientY)
  const seen = new Set<string>()
  for (const el of els) {
    if (draggingEl.contains(el)) continue
    let pkgEl = (el as HTMLElement).closest('[data-package-id]') as HTMLElement | null
    while (pkgEl) {
      if (draggingEl.contains(pkgEl)) break
      const id = pkgEl.dataset.packageId
      if (!id || seen.has(id)) {
        pkgEl = pkgEl.parentElement?.closest('[data-package-id]') as HTMLElement | null
        continue
      }
      seen.add(id)
      if (id !== currentParentId) return id
      pkgEl = pkgEl.parentElement?.closest('[data-package-id]') as HTMLElement | null
    }
  }
  return null
}
