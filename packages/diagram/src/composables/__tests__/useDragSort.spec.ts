import { describe, expect, it, vi } from 'vitest'

import { useDragSort } from '../useDragSort'

function mockDragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      setData: vi.fn(),
      dropEffect: '' as DataTransfer['dropEffect'],
      effectAllowed: '' as DataTransfer['effectAllowed'],
    } as unknown as DataTransfer,
    ...overrides,
  } as unknown as DragEvent
}

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useDragSort', () => {
  it('initialises with null refs', () => {
    const { draggingId, dragOverId } = useDragSort()
    expect(draggingId.value).toBeNull()
    expect(dragOverId.value).toBeNull()
  })

  it('onItemDragStart sets draggingId and calls setData', () => {
    const { draggingId, onItemDragStart } = useDragSort()
    const e = mockDragEvent()
    onItemDragStart(e, { id: 'a' })
    expect(draggingId.value).toBe('a')
    expect(e.dataTransfer?.setData).toHaveBeenCalledWith('text/plain', 'a')
  })

  it('onItemDragEnd resets both refs', () => {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd } = useDragSort()
    onItemDragStart(mockDragEvent(), { id: 'a' })
    onItemDragEnd()
    expect(draggingId.value).toBeNull()
    expect(dragOverId.value).toBeNull()
  })

  it('onItemDragOver does nothing when hovering self', () => {
    const { dragOverId, onItemDragStart, onItemDragOver } = useDragSort()
    onItemDragStart(mockDragEvent(), { id: 'a' })
    onItemDragOver(mockDragEvent(), { id: 'a' })
    expect(dragOverId.value).toBeNull()
  })

  it('onItemDragOver sets dragOverId and dropEffect', () => {
    const { dragOverId, onItemDragStart, onItemDragOver } = useDragSort()
    onItemDragStart(mockDragEvent(), { id: 'a' })
    const e = mockDragEvent()
    onItemDragOver(e, { id: 'b' })
    expect(dragOverId.value).toBe('b')
    expect(e.dataTransfer?.dropEffect).toBe('move')
  })

  it('onItemDragLeave clears dragOverId', () => {
    const { dragOverId, onItemDragStart, onItemDragOver, onItemDragLeave } = useDragSort()
    onItemDragStart(mockDragEvent(), { id: 'a' })
    onItemDragOver(mockDragEvent(), { id: 'b' })
    onItemDragLeave()
    expect(dragOverId.value).toBeNull()
  })

  it('onItemDrop returns reordered ids and resets state', () => {
    const { draggingId, onItemDragStart, onItemDrop } = useDragSort()
    onItemDragStart(mockDragEvent(), items[0])
    const result = onItemDrop(mockDragEvent(), items[1], items)
    expect(result).toEqual(['b', 'a', 'c'])
    expect(draggingId.value).toBeNull()
  })

  it('onItemDrop returns null for self-drop', () => {
    const { onItemDragStart, onItemDrop } = useDragSort()
    onItemDragStart(mockDragEvent(), items[0])
    expect(onItemDrop(mockDragEvent(), items[0], items)).toBeNull()
  })

  it('onItemDrop returns null when draggingId is null', () => {
    const { onItemDrop } = useDragSort()
    expect(onItemDrop(mockDragEvent(), items[1], items)).toBeNull()
  })

  it('stops propagation on dragstart/dragover/drop so outer dropzones cannot override dropEffect', () => {
    // Reason: a parent `useDropZone` (e.g., the Package) flips dropEffect to
    // "none" on dragover when the data type doesn't match its filter. If the
    // row's events bubble, Chrome rejects the drop and the item snaps back —
    // the bug the user reported.
    const { onItemDragStart, onItemDragOver, onItemDrop, onItemDragLeave } = useDragSort()
    const start = mockDragEvent()
    onItemDragStart(start, items[0])
    expect(start.stopPropagation).toHaveBeenCalled()

    const over = mockDragEvent()
    onItemDragOver(over, items[1])
    expect(over.stopPropagation).toHaveBeenCalled()

    const drop = mockDragEvent()
    onItemDrop(drop, items[1], items)
    expect(drop.stopPropagation).toHaveBeenCalled()

    const leave = mockDragEvent()
    onItemDragLeave(leave)
    expect(leave.stopPropagation).toHaveBeenCalled()
  })
})
