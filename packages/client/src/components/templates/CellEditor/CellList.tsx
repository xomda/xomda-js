import { useSortable } from '@vueuse/integrations/useSortable'
import { AddIcon } from '@xomda/icons'
import type { TemplateCell } from '@xomda/template'
import { MenuButton, type MenuItemConfig } from '@xomda/ui'
import { computed, defineComponent, nextTick, type PropType, ref } from 'vue'
import { useGoTo } from 'vuetify'

import type { CellPreview } from '../../../composables'
import { buildCellTypeMenu, CellEditor, isLoopCellType } from './CellEditor'

function newCell(type: TemplateCell['type']): TemplateCell {
  const cell: TemplateCell = { uuid: crypto.randomUUID(), type, content: '' }
  if (isLoopCellType(type)) cell.children = []
  return cell
}

export const CellList = defineComponent({
  name: 'CellList',
  props: {
    cells: { type: Array as PropType<TemplateCell[]>, required: true },
    previews: { type: Object as PropType<Map<string, CellPreview>>, required: true },
    nested: { type: Boolean, default: false },
    scopeVariables: { type: Array as PropType<string[]>, default: () => [] },
    onConfirmDelete: { type: Function as PropType<() => Promise<boolean>>, required: true },
  },
  emits: {
    'update:cells': (_cells: TemplateCell[]) => true,
  },
  setup(props, { emit }) {
    const listEl = ref<HTMLElement | null>(null)
    const cellsRef = computed(() => props.cells)
    const goTo = useGoTo()

    function update(cells: TemplateCell[]) {
      emit('update:cells', cells)
    }

    async function scrollToCell(uuid: string) {
      // The new cell is rendered as a descendant of *some* CellList in the
      // tree, not necessarily this one. Look it up globally by data attribute
      // and ask Vuetify's goTo to scroll its nearest scrollable ancestor.
      await nextTick()
      const el = document.querySelector<HTMLElement>(`[data-cell-uuid="${uuid}"]`)
      if (!el) return
      const container = el.closest<HTMLElement>('.template-cells-scroller') ?? undefined
      try {
        await goTo(el, container ? { container, offset: -16 } : { offset: -16 })
      } catch {
        // Vuetify may throw if the container isn't scrollable; fall back to
        // the native scrollIntoView API which works regardless.
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    function addCell(type: TemplateCell['type'], atIndex: number) {
      const cell = newCell(type)
      const cells = [...props.cells]
      cells.splice(atIndex, 0, cell)
      update(cells)
      void scrollToCell(cell.uuid)
    }

    function updateCell(index: number, cell: TemplateCell) {
      const cells = [...props.cells]
      cells[index] = cell
      update(cells)
    }

    async function deleteCell(index: number) {
      const ok = await props.onConfirmDelete()
      if (!ok) return
      update(props.cells.filter((_, i) => i !== index))
    }

    function moveCell(from: number, to: number) {
      if (from === to) return
      const cells = [...props.cells]
      const [item] = cells.splice(from, 1)
      cells.splice(to, 0, item)
      update(cells)
    }

    function updateChildren(index: number, children: TemplateCell[]) {
      updateCell(index, { ...props.cells[index], children })
    }

    function typeItemsForIndex(atIndex: number): MenuItemConfig[] {
      return buildCellTypeMenu((t) => ({
        onClick: () => addCell(t, atIndex),
      }))
    }

    useSortable(listEl, cellsRef, {
      handle: '.cell-drag-handle',
      animation: 150,
      ghostClass: 'cell-drag-ghost',
      chosenClass: 'cell-drag-chosen',
      onUpdate(e) {
        if (e.oldIndex !== undefined && e.newIndex !== undefined) {
          moveCell(e.oldIndex, e.newIndex)
        }
      },
    })

    return () => {
      const { cells, previews, nested } = props
      return (
        <div
          ref={listEl}
          class={nested ? 'cell-list cell-list--nested' : 'cell-list'}
          style={
            nested
              ? // Vertical padding gives the first/last child's add-above /
                // add-below plus icons (which sit at top/bottom -10px) room
                // to breathe against the surrounding loop cell and the cell
                // after the loop.
                { paddingLeft: '24px', paddingTop: '8px', paddingBottom: '8px' }
              : {}
          }
        >
          {cells.map((cell, index) => {
            const isLoop = isLoopCellType(cell.type)
            const childScope = isLoop && cell.variableName
              ? [...props.scopeVariables, cell.variableName]
              : props.scopeVariables
            // Wrap cell + (optional) child list in a single sortable item so
            // useSortable sees exactly one DOM child per entry in `cells`.
            return (
              <div key={cell.uuid} class="xomda-cell-wrapper" data-cell-uuid={cell.uuid}>
                <CellEditor
                  cell={cell}
                  index={index}
                  total={cells.length}
                  preview={previews.get(cell.uuid)}
                  addAboveOptions={typeItemsForIndex(index)}
                  addBelowOptions={typeItemsForIndex(index + 1)}
                  scopeVariables={props.scopeVariables}
                  onUpdate:cell={(c) => updateCell(index, c)}
                  onDelete={() => deleteCell(index)}
                  onMoveUp={() => moveCell(index, index - 1)}
                  onMoveDown={() => moveCell(index, index + 1)}
                />
                {isLoop && (
                  <CellList
                    cells={cell.children ?? []}
                    previews={previews}
                    nested
                    scopeVariables={childScope}
                    onConfirmDelete={props.onConfirmDelete}
                    onUpdate:cells={(children) => updateChildren(index, children)}
                  />
                )}
              </div>
            )
          })}

          {cells.length === 0 && (
            <MenuButton
              icon={AddIcon}
              tooltip="Add cell"
              variant="tonal"
              items={typeItemsForIndex(0)}
              class={nested ? 'my-2 ml-2' : ''}
            />
          )}
        </div>
      )
    }
  },
})
