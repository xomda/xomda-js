import type { Template, TemplateCell } from '@xomda/template'
import { useConfirm } from '@xomda/ui'
import { computed, defineComponent, type PropType, watch } from 'vue'
import { VSheet } from 'vuetify/components'

import { useTemplatePreview } from '../../composables'
import { CellList, registerCellContextStaticLib, setCellContextVariablesLib } from './CellEditor'

registerCellContextStaticLib()

function collectVariableNames(cells: TemplateCell[]): (string | undefined)[] {
  const out: (string | undefined)[] = []
  for (const c of cells) {
    out.push(c.variableName)
    if (c.children?.length) out.push(...collectVariableNames(c.children))
  }
  return out
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
    const previews = useTemplatePreview(computed(() => props.template))

    function updateCells(cells: TemplateCell[]) {
      emit('update:template', { ...props.template, cells })
    }

    async function confirmDelete(): Promise<boolean> {
      return confirm({
        title: 'Delete cell',
        message: 'This cell will be removed from the template. This action cannot be undone.',
        confirmLabel: 'Delete',
        confirmColor: 'error',
      })
    }

    watch(
      () => collectVariableNames(props.template.cells),
      (varNames) => setCellContextVariablesLib(varNames),
      { immediate: true }
    )

    return () => (
      <VSheet class="template-cells-scroller px-4 pt-1 h-100 overflow-y-auto" color="transparent">
        <CellList
          cells={props.template.cells}
          previews={previews.value}
          onConfirmDelete={confirmDelete}
          onUpdate:cells={updateCells}
        />
      </VSheet>
    )
  },
})
