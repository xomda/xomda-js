import type { TemplateCell } from '@xomda/template'
import { defineComponent, type PropType } from 'vue'
import { VCardText, VSelect, VTextField } from 'vuetify/components'

import { CellFormFields } from './CellFormFields'

// Widened to `{ title: string; value: string }[]` so VSelect's items prop
// (which accepts that shape, not a readonly tuple of literal-typed objects)
// type-checks without a cast.
const OUTPUT_TYPE_ITEMS: { title: string; value: string }[] = [
  { title: 'File', value: 'file' },
  { title: 'Context', value: 'context' },
]

export const OutputCellForm = defineComponent({
  name: 'OutputCellForm',
  props: { cell: { type: Object as PropType<TemplateCell>, required: true } },
  emits: { 'update:cell': (_c: TemplateCell) => true },
  setup(props, { emit }) {
    function patch(fields: Partial<TemplateCell>) {
      emit('update:cell', { ...props.cell, ...fields })
    }
    return () => {
      const outputType = props.cell.outputType ?? 'file'
      return (
        <VCardText class="d-flex flex-column ga-2 pt-3 pb-3">
          <CellFormFields>
            <VSelect
              modelValue={outputType}
              items={OUTPUT_TYPE_ITEMS}
              label="Output to"
              onUpdate:modelValue={(v: string) =>
                patch({ outputType: (v as TemplateCell['outputType']) ?? 'file' })
              }
            />
            {outputType === 'file' ? (
              <VTextField
                modelValue={props.cell.outputFilename ?? ''}
                label="Filename"
                placeholder="src/entities/{{pascalCase entity.name}}.ts"
                onUpdate:modelValue={(v: string) => patch({ outputFilename: v || undefined })}
              />
            ) : (
              <VTextField
                modelValue={props.cell.outputContent ?? ''}
                label="Variable name"
                placeholder="myContent"
                onUpdate:modelValue={(v: string) => patch({ outputContent: v || undefined })}
              />
            )}
          </CellFormFields>
        </VCardText>
      )
    }
  },
})
