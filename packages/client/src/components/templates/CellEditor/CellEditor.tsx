import { CodeEditor } from '@xomda/codeeditor'
import {
  BufferIcon,
  HandlebarsIcon,
  LogicIcon,
  LoopIcon,
  MarkdownIcon,
  OutputIcon,
} from '@xomda/icons'
import type { TemplateCell } from '@xomda/template'
import { Cell, Collapsible, type MenuItemConfig } from '@xomda/ui'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { useTheme } from 'vuetify'
import { VChip, VProgressCircular, VTextField } from 'vuetify/components'

import type { CellPreview } from '../../../composables'
import { PanelDivider } from '../../PanelDivider'
import { LoopCellForm } from './LoopCellForm'
import { LoopLogicCellForm } from './LoopLogicCellForm'
import { OutputCellForm } from './OutputCellForm'
import { useCellEditorHeight } from './useCellEditorHeight'

const CELL_LANGUAGE: Record<TemplateCell['type'], string> = {
  logic: 'javascript',
  markdown: 'markdown',
  handlebars: 'handlebars',
  buffer: 'javascript',
  output: 'javascript',
  loop: 'javascript',
  'loop-logic': 'javascript',
}

export const CELL_LABEL: Record<TemplateCell['type'], string> = {
  logic: 'JavaScript',
  markdown: 'Markdown',
  handlebars: 'Handlebars',
  buffer: 'Buffer',
  output: 'Output',
  loop: 'Loop',
  'loop-logic': 'Loop (logic)',
}

export const CELL_TYPES: TemplateCell['type'][] = [
  'loop',
  'logic',
  'markdown',
  'handlebars',
  'buffer',
  'output',
]

export const CELL_ICON: Record<TemplateCell['type'], string> = {
  logic: LogicIcon,
  markdown: MarkdownIcon,
  handlebars: HandlebarsIcon,
  buffer: BufferIcon,
  output: OutputIcon,
  loop: LoopIcon,
  'loop-logic': LoopIcon,
}

export function isLoopCellType(type: TemplateCell['type']): boolean {
  return type === 'loop' || type === 'loop-logic'
}

const CELL_CATEGORY: Record<TemplateCell['type'], 'iteration' | 'content' | 'output'> = {
  loop: 'iteration',
  'loop-logic': 'iteration',
  logic: 'content',
  markdown: 'content',
  handlebars: 'content',
  buffer: 'content',
  output: 'output',
}

const CATEGORY_LABEL: Record<'iteration' | 'content' | 'output', string> = {
  iteration: 'Iteration',
  content: 'Content',
  output: 'Output',
}

/**
 * Build a menu of cell types grouped under category subheaders:
 * "Iteration" / "Content" / "Output".
 */
export function buildCellTypeMenu(
  build: (type: TemplateCell['type']) => Omit<MenuItemConfig, 'key' | 'title' | 'icon'>
): MenuItemConfig[] {
  const items: MenuItemConfig[] = []
  let lastCategory: string | undefined
  CELL_TYPES.forEach((type) => {
    const category = CELL_CATEGORY[type]
    if (category !== lastCategory) {
      items.push({ subheader: CATEGORY_LABEL[category], key: `subheader-${category}` })
      lastCategory = category
    }
    items.push({
      key: type,
      title: CELL_LABEL[type],
      icon: CELL_ICON[type],
      ...build(type),
    } as MenuItemConfig)
  })
  return items
}

export const CellEditor = defineComponent({
  name: 'CellEditor',
  props: {
    cell: { type: Object as PropType<TemplateCell>, required: true },
    index: { type: Number, required: true },
    total: { type: Number, required: true },
    preview: { type: Object as PropType<CellPreview>, default: undefined },
    addAboveOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    addBelowOptions: { type: Array as PropType<MenuItemConfig[]>, default: undefined },
    scopeVariables: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: {
    'update:cell': (_cell: TemplateCell) => true,
    delete: (_index: number) => true,
    moveUp: (_index: number) => true,
    moveDown: (_index: number) => true,
    addAbove: (_index: number) => true,
    addBelow: (_index: number) => true,
  },
  setup(props, { emit }) {
    const theme = useTheme()
    const { height, onResize, onEditorInit } = useCellEditorHeight(props.cell.uuid)

    const bodyOpen = ref(true)

    const typeOptions = computed<MenuItemConfig[]>(() =>
      buildCellTypeMenu((t) => ({
        active: t === props.cell.type,
        onClick: () => {
          if (t !== props.cell.type) {
            emit('update:cell', { ...props.cell, type: t })
          }
        },
      }))
    )

    return () => {
      const { cell, index, total, preview } = props
      const state = preview?.state
      const isDark = theme.global.current.value.dark
      const isLoop = isLoopCellType(cell.type)
      const hasBody = cell.type !== 'buffer' && !isLoop
      const collapsed = cell.type === 'buffer' || (hasBody && !bodyOpen.value)
      const previewReady = !!state?.done
      const hasPreviewContent =
        previewReady &&
        (!!state!.output ||
          !!state!.error ||
          !!state!.consoleLogs.length ||
          Object.keys(state!.contextDiff).length > 0)

      return (
        <Cell
          typeOptions={typeOptions.value}
          disableMoveUp={index === 0}
          disableMoveDown={index === total - 1}
          collapsed={collapsed}
          addAboveOptions={props.addAboveOptions}
          addBelowOptions={props.addBelowOptions}
          onDelete={() => emit('delete', index)}
          onMoveUp={() => emit('moveUp', index)}
          onMoveDown={() => emit('moveDown', index)}
          onAddAbove={() => emit('addAbove', index)}
          onAddBelow={() => emit('addBelow', index)}
        >
          {{
            toolbar:
              cell.type === 'buffer'
                ? () => (
                    <VTextField
                      modelValue={cell.variableName ?? ''}
                      placeholder="variable name"
                      density="compact"
                      variant="plain"
                      hide-details
                      class="mx-2"
                      style={{
                        '--v-input-control-height': '22px',
                      }}
                      onUpdate:modelValue={(v: string) =>
                        emit('update:cell', { ...props.cell, variableName: v || undefined })
                      }
                    />
                  )
                : undefined,

            default: () => (
              <>
                {cell.type === 'loop' && (
                  <LoopCellForm
                    cell={cell}
                    scopeVariables={props.scopeVariables}
                    onUpdate:cell={(c) => emit('update:cell', c)}
                  />
                )}
                {cell.type === 'loop-logic' && (
                  <LoopLogicCellForm
                    cell={cell}
                    scopeVariables={props.scopeVariables}
                    onUpdate:cell={(c) => emit('update:cell', c)}
                  />
                )}
                {hasBody && (
                  <Collapsible
                    modelValue={bodyOpen.value}
                    onUpdate:modelValue={(v: boolean) => (bodyOpen.value = v)}
                  >
                    {{
                      chip: () => (
                        <VChip size="x-small" class={['rounded']} variant="tonal">
                          {CELL_LABEL[cell.type]}
                        </VChip>
                      ),
                      default: () =>
                        cell.type === 'output' ? (
                          <OutputCellForm
                            cell={cell}
                            onUpdate:cell={(c) => emit('update:cell', c)}
                          />
                        ) : (
                          <>
                            <CodeEditor
                              modelValue={cell.content}
                              language={CELL_LANGUAGE[cell.type]}
                              theme={isDark ? 'xomda-dark' : 'xomda-light'}
                              height={height.value}
                              onInit={onEditorInit}
                              onUpdate:modelValue={(content: string) =>
                                emit('update:cell', { ...props.cell, content })
                              }
                            />
                            <PanelDivider orientation="vertical" onResize={onResize} />
                          </>
                        ),
                    }}
                  </Collapsible>
                )}

                <Collapsible label="Output" modelValue={false}>
                  {{
                    default: () =>
                      !previewReady ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            opacity: 0.6,
                          }}
                        >
                          <VProgressCircular indeterminate size={14} width={2} />
                          <span>Running…</span>
                        </div>
                      ) : !hasPreviewContent ? (
                        <div style={{ padding: '8px 12px', fontSize: '12px', opacity: 0.6 }}>
                          No output
                        </div>
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '12px' }}>
                          {state!.error && (
                            <div
                              style={{ color: 'rgb(var(--v-theme-error))', marginBottom: '6px' }}
                            >
                              <strong>Error:</strong> {state!.error}
                            </div>
                          )}
                          {state!.output && (
                            <pre
                              style={{
                                margin: '0 0 6px',
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                              }}
                            >
                              {state!.output}
                            </pre>
                          )}
                          {Object.keys(state!.contextDiff).length > 0 && (
                            <table
                              style={{
                                borderCollapse: 'collapse',
                                marginBottom: '6px',
                                width: '100%',
                              }}
                            >
                              <tbody>
                                {Object.entries(state!.contextDiff).map(([k, v]) => {
                                  const isString = typeof v === 'string'
                                  const text = isString ? v : JSON.stringify(v, null, 2)
                                  const lineCount = text.split('\n').length
                                  const editorHeight = Math.min(
                                    240,
                                    Math.max(22, lineCount * 18 + 8)
                                  )
                                  return (
                                    <tr key={k}>
                                      <td
                                        style={{
                                          fontFamily: 'monospace',
                                          fontWeight: 'bold',
                                          paddingRight: '8px',
                                          whiteSpace: 'nowrap',
                                          verticalAlign: 'top',
                                        }}
                                      >
                                        {k}
                                      </td>
                                      <td style={{ width: '100%' }}>
                                        <CodeEditor
                                          class={['rounded']}
                                          modelValue={text}
                                          language={isString ? 'plaintext' : 'json'}
                                          theme={isDark ? 'xomda-dark' : 'xomda-light'}
                                          readOnly
                                          lineNumbers={false}
                                          stickyScroll={false}
                                          width="100%"
                                          height={editorHeight}
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                          {state!.consoleLogs.map((line: string, i: number) => (
                            <div
                              key={i}
                              style={{ fontFamily: 'monospace', opacity: 0.6, fontSize: '11px' }}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ),
                  }}
                </Collapsible>
              </>
            ),
          }}
        </Cell>
      )
    }
  },
})
