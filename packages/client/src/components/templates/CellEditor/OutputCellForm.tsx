import type { TemplateCell } from '@xomda/template'
import { defineComponent, type PropType } from 'vue'
import { VCardText, VTextField } from 'vuetify/components'

export const OutputCellForm = defineComponent({
  name: 'OutputCellForm',
  props: { cell: { type: Object as PropType<TemplateCell>, required: true } },
  emits: { 'update:cell': (_c: TemplateCell) => true },
  setup(props, { emit }) {
    function patch(fields: Partial<TemplateCell>) {
      emit('update:cell', { ...props.cell, ...fields })
    }
    return () => (
      <VCardText class="d-flex flex-column ga-3 pt-4">
        <VTextField
          modelValue={props.cell.outputFilename ?? ''}
          label="Filename"
          hint="Handlebars expression — e.g. src/entities/{{pascalCase entity.name}}.ts"
          persistent-hint
          density="compact"
          variant="outlined"
          onUpdate:modelValue={(v: string) => patch({ outputFilename: v || undefined })}
        />
        <VTextField
          modelValue={props.cell.outputContent ?? ''}
          label="Content variable"
          hint="Name of the buffer or variable to write — e.g. myBuffer"
          persistent-hint
          density="compact"
          variant="outlined"
          onUpdate:modelValue={(v: string) => patch({ outputContent: v || undefined })}
        />
      </VCardText>
    )
  },
})
