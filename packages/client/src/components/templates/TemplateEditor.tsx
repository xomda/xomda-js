import { useSortable } from '@vueuse/integrations/useSortable'
import { AddIcon } from '@xomda/icons'
import type { CellInstance, Template,TemplateCell } from '@xomda/template'
import { Menu, type MenuItemConfig, useConfirm } from '@xomda/ui'
import { computed, defineComponent, type PropType, ref, watch } from 'vue'
import { VBtn, VMenu, VSheet } from 'vuetify/components'

import { useTemplatePreview } from '../../composables'
import {
  CELL_LABEL,
  CELL_TYPES,
  CellEditor,
  registerCellContextStaticLib,
  setCellContextVariablesLib,
} from './CellEditor'

registerCellContextStaticLib()

function newCell(type: TemplateCell['type']): TemplateCell {
  return {
    uuid: crypto.randomUUID(),
    type,
    content: '',
  }
}

export const TemplateEditor = defineComponent({
  name: 'TemplateEditor',
  props: {
    template: { type: Object as PropType<Template>, required: true },
  },
  emits: {
    'update:template': (_t: Template) => true,
  },
  setup(props, { emit }) {
    const { confirm } = useConfirm()
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

    async function deleteCell(index: number) {
      const ok = await confirm({
        title: 'Delete cell',
        message: 'This cell will be removed from the template. This action cannot be undone.',
        confirmLabel: 'Delete',
        confirmColor: 'error',
      })
      if (!ok) return
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

    const cells = computed(() => props.template.cells)

    watch(
      () => props.template.cells.map((c) => c.variableName),
      (varNames) => setCellContextVariablesLib(varNames),
      { immediate: true }
    )
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

    function emptyStateTypeItems(atIndex: number): MenuItemConfig[] {
      return CELL_TYPES.map((t) => ({
        key: t,
        title: CELL_LABEL[t],
        onClick: () => addCell(t, atIndex),
      }))
    }

    return () => {
      const { cells: templateCells } = props.template

      return (
        <VSheet class="pa-4 h-100 overflow-y-auto" color="transparent">
          <div ref={listEl}>
            {templateCells.map((cell, index) => (
              <CellEditor
                key={cell.uuid}
                cell={cell}
                index={index}
                total={templateCells.length}
                cellInstance={instanceMap.value.get(cell.uuid)}
                onUpdate:cell={(c) => updateCell(index, c)}
                onDelete={() => deleteCell(index)}
                onMoveUp={() => moveCell(index, index - 1)}
                onMoveDown={() => moveCell(index, index + 1)}
                onAddAbove={() => addCell(cell.type, index)}
                onAddBelow={() => addCell(cell.type, index + 1)}
              />
            ))}
          </div>

          {templateCells.length === 0 && (
            <VMenu>
              {{
                activator: ({ props: menuProps }: any) => (
                  <VBtn
                    {...menuProps}
                    icon={AddIcon as any}
                    size="small"
                    density="comfortable"
                    variant="tonal"
                    aria-label="Add cell"
                  />
                ),
                default: () => <Menu items={emptyStateTypeItems(0)} />,
              }}
            </VMenu>
          )}
        </VSheet>
      )
    }
  },
})
