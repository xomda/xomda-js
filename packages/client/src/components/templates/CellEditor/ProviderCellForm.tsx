import { CodeEditor } from '@xomda/codeeditor'
import type { TemplateCell } from '@xomda/template'
import { defineComponent, type PropType } from 'vue'
import { useTheme } from 'vuetify'
import { VCardText, VSelect, VTextField } from 'vuetify/components'

const PROVIDER_DEFAULT_CONTENT = `function* provide(model) {
  for (const pkg of (model.packages ?? [])) {
    for (const entity of (pkg.entities ?? [])) {
      yield entity
    }
  }
}`

const SOURCE_ITEMS = [
  { title: 'Entities', value: 'entities' },
  { title: 'Enums', value: 'enums' },
  { title: 'Packages', value: 'packages' },
  { type: 'divider' },
  { title: 'JavaScript generator', value: 'javascript' },
] as const

export const ProviderCellForm = defineComponent({
  name: 'ProviderCellForm',
  props: { cell: { type: Object as PropType<TemplateCell>, required: true } },
  emits: { 'update:cell': (_c: TemplateCell) => true },
  setup(props, { emit }) {
    const theme = useTheme()

    function patch(fields: Partial<TemplateCell>) {
      emit('update:cell', { ...props.cell, ...fields })
    }

    return () => {
      const isDark = theme.global.current.value.dark
      const isJavaScript = props.cell.providerSource === 'javascript'

      return (
        <VCardText class="d-flex flex-column ga-3 pt-4">
          <VSelect
            modelValue={props.cell.providerSource ?? null}
            items={SOURCE_ITEMS as unknown as { title: string; value: string }[]}
            label="Source"
            density="compact"
            variant="outlined"
            clearable
            onUpdate:modelValue={(v: string | null) => {
              const source = (v as TemplateCell['providerSource']) ?? undefined
              const needsPrefill = source === 'javascript' && !props.cell.content
              patch({
                providerSource: source,
                ...(needsPrefill ? { content: PROVIDER_DEFAULT_CONTENT } : {}),
              })
            }}
          />
          <VTextField
            modelValue={props.cell.variableName ?? ''}
            label="Variable name"
            hint="Identifier put on context per iteration — e.g. entity"
            persistent-hint
            density="compact"
            variant="outlined"
            onUpdate:modelValue={(v: string) => patch({ variableName: v || undefined })}
          />
          {isJavaScript && (
            <CodeEditor
              modelValue={props.cell.content}
              language="javascript"
              theme={isDark ? 'xomda-dark' : 'xomda-light'}
              height={200}
              onUpdate:modelValue={(content: string) => patch({ content })}
            />
          )}
        </VCardText>
      )
    }
  },
})
