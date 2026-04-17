import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findDropTarget, useCanvasDrag } from '../useCanvasDrag'

beforeEach(() => {
  if (!('elementsFromPoint' in document)) {
    ;(document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => []
  }
})

afterEach(() => {
  useCanvasDrag().end()
  document.body.innerHTML = ''
})

describe('useCanvasDrag', () => {
  it('start sets draggingId and clears dropTargetPackageId', () => {
    const drag = useCanvasDrag()
    drag.setDropTarget('stale')
    drag.start('item-1')
    expect(drag.draggingId.value).toBe('item-1')
    expect(drag.dropTargetPackageId.value).toBeNull()
  })

  it('setDropTarget tracks the candidate target package id', () => {
    const drag = useCanvasDrag()
    drag.start('item-1')
    drag.setDropTarget('pkg-2')
    expect(drag.dropTargetPackageId.value).toBe('pkg-2')
    drag.setDropTarget(null)
    expect(drag.dropTargetPackageId.value).toBeNull()
  })

  it('end clears all state', () => {
    const drag = useCanvasDrag()
    drag.start('item-1')
    drag.setDropTarget('pkg-2')
    drag.end()
    expect(drag.draggingId.value).toBeNull()
    expect(drag.dropTargetPackageId.value).toBeNull()
  })

  it('shares state across all callers (singleton)', () => {
    const a = useCanvasDrag()
    const b = useCanvasDrag()
    a.start('item-x')
    expect(b.draggingId.value).toBe('item-x')
  })
})

describe('findDropTarget', () => {
  function makePackageEl(id: string): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-package-id', id)
    document.body.appendChild(el)
    return el
  }

  it('returns null when no package is under the pointer', () => {
    const dragging = makePackageEl('drag-1')
    expect(findDropTarget(0, 0, dragging, undefined)).toBeNull()
  })

  it('returns null when the only package under pointer is the current parent', () => {
    const parent = makePackageEl('parent-1')
    const dragging = document.createElement('div')
    parent.appendChild(dragging)
    document.elementsFromPoint = () => [dragging, parent, document.body]
    expect(findDropTarget(50, 50, dragging, 'parent-1')).toBeNull()
  })

  it('returns the target id when a different package is under pointer', () => {
    const otherPkg = makePackageEl('other-1')
    const dragging = document.createElement('div')
    document.body.appendChild(dragging)
    document.elementsFromPoint = () => [otherPkg, document.body]
    expect(findDropTarget(50, 50, dragging, 'parent-1')).toBe('other-1')
  })

  it('skips elements that are descendants of the dragging item', () => {
    const dragging = makePackageEl('drag-pkg')
    const inner = makePackageEl('inner-pkg')
    dragging.appendChild(inner)
    const outer = makePackageEl('outer-pkg')
    document.elementsFromPoint = () => [inner, dragging, outer, document.body]
    // inner is inside dragging → skip; dragging itself → skip; outer matches.
    expect(findDropTarget(50, 50, dragging, undefined)).toBe('outer-pkg')
  })

  it('returns ancestor package when cursor is over the current parent', () => {
    // Simulates dragging an item out of its current parent into the
    // grandparent: the current parent (and its ancestor) are both under the
    // pointer; the function should walk past the current parent and return
    // the ancestor.
    const grandparent = makePackageEl('grandparent')
    const parent = makePackageEl('parent')
    grandparent.appendChild(parent)
    const dragging = document.createElement('div')
    parent.appendChild(dragging)
    document.elementsFromPoint = () => [dragging, parent, grandparent, document.body]
    expect(findDropTarget(50, 50, dragging, 'parent')).toBe('grandparent')
  })

  it('returns null while pointer is still inside current parent bounds', () => {
    // Stay-in-parent guard: items only "leave" when dragged outside the parent's
    // bounding rect, even if the pointer is over an ancestor in the element stack.
    const grandparent = makePackageEl('grandparent')
    const parent = makePackageEl('parent')
    grandparent.appendChild(parent)
    parent.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 }) as DOMRect
    const dragging = document.createElement('div')
    parent.appendChild(dragging)
    document.elementsFromPoint = () => [dragging, parent, grandparent, document.body]
    expect(findDropTarget(50, 50, dragging, 'parent')).toBeNull()
  })
})
