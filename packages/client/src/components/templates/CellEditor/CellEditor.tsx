import { CodeEditor, type Editor, type MonacoCodeEditor } from '@xomda/codeeditor'
import { BufferIcon, HandlebarsIcon, LogicIcon, LoopIcon, MarkdownIcon, OutputIcon, } from '@xomda/icons'
import type { TemplateCell } from '@xomda/template'
import { Cell, Collapsible, type MenuItemConfig, useLocalStorageStore } from '@xomda/ui'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { useTheme } from 'vuetify'
import { VTextField } from 'vuetify/components'

import type { CellPreview } from '../../../composables'
import { PanelDivider } from '../../PanelDivider'
import { LoopCellForm } from './LoopCellForm'
import { LoopLogicCellForm } from './LoopLogicCellForm'
import { OutputCellForm } from './OutputCellForm'

const MIN_H = 80
const MAX_H = 600
const DEFAULT_H = 120
const AUTO_FIT_PADDING = 8

function clampHeight(value: number): number {
  return Math.max(MIN_H, Math.min(MAX_H, value))
}

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

/**
 * Build a menu of cell types with dividers between categories: the
 * iteration-related `loop` is grouped alone at the top, the content cells in
 * the middle, and the terminal `output` cell at the bottom.
 */
export function buildCellTypeMenu(
  build: (type: TemplateCell['type']) => Omit<MenuItemConfig, 'key' | 'title' | 'icon'>
): MenuItemConfig[] {
  const items: MenuItemConfig[] = []
  CELL_TYPES.forEach((type, i) => {
    const prev = CELL_TYPES[i - 1]
    if (prev === 'loop' || type === 'output') {
      items.push({ divider: true, key: `divider-${i}` })
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
    const store = useLocalStorageStore()

    const storedHeight = store.cellHeights[props.cell.uuid]
    const height = ref(storedHeight ?? DEFAULT_H)
    let autoFitDone = storedHeight != null

    const bodyOpen = ref(true)

    function onResize(delta: number) {
      const next = clampHeight(height.value + delta)
      if (next === height.value) return
      height.value = next
      store.cellHeights = { ...store.cellHeights, [props.cell.uuid]: next }
    }

    function onEditorInit(editor: Editor) {
      if (autoFitDone) return
      const codeEditor = editor as MonacoCodeEditor
      const sub = codeEditor.onDidContentSizeChange(() => {
        if (autoFitDone) return
        autoFitDone = true
        height.value = clampHeight(codeEditor.getContentHeight() + AUTO_FIT_PADDING)
        sub.dispose()
      })
    }

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
      const hasPreview =
        !!state?.done &&
        (!!state.output ||
          !!state.error ||
          !!state.consoleLogs.length ||
          Object.keys(state.contextDiff).length > 0)

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
                  <LoopCellForm cell={cell} onUpdate:cell={(c) => emit('update:cell', c)} />
                )}
                {cell.type === 'loop-logic' && (
                  <LoopLogicCellForm cell={cell} onUpdate:cell={(c) => emit('update:cell', c)} />
                )}
                {hasBody && (
                  <Collapsible
                    modelValue={bodyOpen.value}
                    onUpdate:modelValue={(v: boolean) => (bodyOpen.value = v)}
                  >
                    {{
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

                {hasPreview && (
                  <Collapsible label="Output" modelValue={false}>
                    {{
                      default: () => (
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
                                {Object.entries(state!.contextDiff).map(([k, v]) => (
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
                                    <td
                                      style={{
                                        fontFamily: 'monospace',
                                        opacity: 0.8,
                                        whiteSpace: 'pre-wrap',
                                      }}
                                    >
                                      {typeof v === 'string' ? v : JSON.stringify(v, null, 2)}
                                    </td>
                                  </tr>
                                ))}
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
                )}
              </>
            ),
          }}
        </Cell>
      )
    }
  },
})
