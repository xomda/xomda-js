import { CodeEditor } from '@xomda/codeeditor'
import type { TemplateCell } from '@xomda/template'
import { defineComponent, onMounted, type PropType } from 'vue'
import { useTheme } from 'vuetify'
import { VCardText, VTextField } from 'vuetify/components'

import { CellFormFields } from './CellFormFields'
import { buildLoopDefaultContent } from './loopPrefill'

export const LoopLogicCellForm = defineComponent({
  name: 'LoopLogicCellForm',
  props: {
    cell: { type: Object as PropType<TemplateCell>, required: true },
    scopeVariables: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: { 'update:cell': (_c: TemplateCell) => true },
  setup(props, { emit }) {
    const theme = useTheme()

    function patch(fields: Partial<TemplateCell>) {
      emit('update:cell', { ...props.cell, ...fields })
    }

    // loop-logic is always JS-generator. Seed empty content with a
    // scope-aware default so a newly-created cell isn't blank.
    onMounted(() => {
      if (!props.cell.content) {
        patch({ content: buildLoopDefaultContent(props.scopeVariables) })
      }
    })

    return () => {
      const isDark = theme.global.current.value.dark
      return (
        <VCardText class="d-flex flex-column ga-2 pt-3 pb-3">
          <CellFormFields>
            <VTextField
              modelValue={props.cell.variableName ?? ''}
              label="Variable name"
              placeholder="item"
              onUpdate:modelValue={(v: string) => patch({ variableName: v || undefined })}
            />
          </CellFormFields>
          <CodeEditor
            modelValue={props.cell.content}
            language="javascript"
            theme={isDark ? 'xomda-dark' : 'xomda-light'}
            height={200}
            onUpdate:modelValue={(content: string) => patch({ content })}
          />
        </VCardText>
      )
    }
  },
})
