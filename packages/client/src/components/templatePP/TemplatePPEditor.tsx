import { useSortable } from '@vueuse/integrations/useSortable'
import type { CellInstance, TemplateCell, Template } from '@xomda/template'
import { CellSeparator } from '@xomda/ui'
import { computed, defineComponent, Fragment, type PropType, ref, watch } from 'vue'
import { VSheet } from 'vuetify/components'

import { useTemplatePreview } from '../../composables'
import { CellEditor } from './CellEditor'

const CELL_TYPES: TemplateCell['type'][] = ['logic', 'markdown', 'handlebars', 'buffer', 'output', 'provider']

const CELL_TYPE_LABELS: Record<string, string> = {
  logic: 'JavaScript',
}

function newCell(type: TemplateCell['type']): TemplateCell {
  return {
    uuid: crypto.randomUUID(),
    type,
    content: '',
  }
}

export const TemplatePPEditor = defineComponent({
  name: 'TemplatePPEditor',
  props: {
    template: { type: Object as PropType<Template>, required: true },
  },
  emits: {
    'update:template': (_t: Template) => true,
  },
  setup(props, { emit }) {
    const cellInstances = useTemplatePreview(computed(() => props.template))

    const instanceMap = computed(
      () => new Map<string, CellInstance>(cellInstances.value.map((inst) => [inst.cell.uuid, inst]))
    )

    const listEl = ref<HTMLElement | null>(null)

    function updateCells(cells: TemplateCell[]) {
      emit('update:template', { ...props.template, cells })
    }

    function addCell(type: TemplateCell['type'], atIndex: number) {
      const cells = [...props.template.cells]
      cells.splice(atIndex, 0, newCell(type))
      updateCells(cells)
    }

    function updateCell(index: number, cell: TemplateCell) {
      const cells = [...props.template.cells]
      cells[index] = cell
      updateCells(cells)
    }

    function deleteCell(index: number) {
      const cells = props.template.cells.filter((_, i) => i !== index)
      updateCells(cells)
    }

    function moveCell(from: number, to: number) {
      if (from === to) return
      const cells = [...props.template.cells]
      const [item] = cells.splice(from, 1)
      cells.splice(to, 0, item)
      updateCells(cells)
    }

    // useSortable syncs the template cells array on drag-end
    const cells = computed(() => props.template.cells)
    useSortable(listEl, cells, {
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
      const { cells: templateCells } = props.template

      return (
        <VSheet class="pa-4 h-100 overflow-y-auto" color="transparent">
          <CellSeparator
            cellTypes={CELL_TYPES}
            cellTypeLabels={CELL_TYPE_LABELS}
            onAdd={(type) => addCell(type as TemplateCell['type'], 0)}
          />

          <div ref={listEl}>
            {templateCells.map((cell, index) => (
              <Fragment key={cell.uuid}>
                <CellEditor
                  cell={cell}
                  index={index}
                  total={templateCells.length}
                  cellInstance={instanceMap.value.get(cell.uuid)}
                  class="mb-0"
                  onUpdate:cell={(c) => updateCell(index, c)}
                  onDelete={() => deleteCell(index)}
                  onMoveUp={() => moveCell(index, index - 1)}
                  onMoveDown={() => moveCell(index, index + 1)}
                />

                <CellSeparator
                  cellTypes={CELL_TYPES}
                  cellTypeLabels={CELL_TYPE_LABELS}
                  onAdd={(type) => addCell(type as TemplateCell['type'], index + 1)}
                />
              </Fragment>
            ))}
          </div>
        </VSheet>
      )
    }
  },
})
