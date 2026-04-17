import { CodeEditor } from '@xomda/codeeditor'
import type { TemplateCell } from '@xomda/template'
import { defineComponent, type PropType } from 'vue'
import { useTheme } from 'vuetify'
import { VCardText, VSelect, VTextField } from 'vuetify/components'

import { PanelDivider } from '../../PanelDivider'
import { CellFormFields } from './CellFormFields'
import { buildLoopDefaultContent } from './loopPrefill'
import { useCellEditorHeight } from './useCellEditorHeight'

// VSelect's items accept either an item object or a `{ type: 'divider' }`
// separator; widen to the shared shape so the cast is unnecessary.
type SourceItem = { title: string; value: string } | { type: 'divider' }
const SOURCE_ITEMS: SourceItem[] = [
  { title: 'Entities', value: 'entities' },
  { title: 'Enums', value: 'enums' },
  { title: 'Packages', value: 'packages' },
  { type: 'divider' },
  { title: 'JavaScript generator', value: 'javascript' },
]

export const LoopCellForm = defineComponent({
  name: 'LoopCellForm',
  props: {
    cell: { type: Object as PropType<TemplateCell>, required: true },
    scopeVariables: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: { 'update:cell': (_c: TemplateCell) => true },
  setup(props, { emit }) {
    const theme = useTheme()
    const { height, onResize, onEditorInit } = useCellEditorHeight(props.cell.uuid)

    function patch(fields: Partial<TemplateCell>) {
      emit('update:cell', { ...props.cell, ...fields })
    }

    return () => {
      const isDark = theme.global.current.value.dark
      const isJavaScript = props.cell.loopSource === 'javascript'

      return (
        <VCardText class="d-flex flex-column ga-2 pt-3 pb-3">
          <CellFormFields>
            <VSelect
              modelValue={props.cell.loopSource ?? null}
              items={SOURCE_ITEMS}
              label="Loop over"
              clearable
              onUpdate:modelValue={(v: string | null) => {
                const source = (v as TemplateCell['loopSource']) ?? undefined
                const needsPrefill = source === 'javascript' && !props.cell.content
                patch({
                  loopSource: source,
                  ...(needsPrefill
                    ? { content: buildLoopDefaultContent(props.scopeVariables) }
                    : {}),
                })
              }}
            />
            <VTextField
              modelValue={props.cell.variableName ?? ''}
              class={['text-mono']}
              label="Variable name"
              placeholder="item"
              onUpdate:modelValue={(v: string) => patch({ variableName: v || undefined })}
            />
          </CellFormFields>
          {isJavaScript && (
            <>
              <CodeEditor
                modelValue={props.cell.content}
                language="javascript"
                theme={isDark ? 'xomda-dark' : 'xomda-light'}
                height={height.value}
                onInit={onEditorInit}
                onUpdate:modelValue={(content: string) => patch({ content })}
              />
              <PanelDivider orientation="vertical" onResize={onResize} />
            </>
          )}
        </VCardText>
      )
    }
  },
})
