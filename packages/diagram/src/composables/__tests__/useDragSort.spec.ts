import { describe, expect, it, vi } from 'vitest'

import { useDragSort } from '../useDragSort'

function mockDragEvent(overrides: Partial<DragEvent> = {}): DragEvent {
  return {
    preventDefault: vi.fn(),
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
})
