import './CodeEditor.scss'

import { isNumberLike } from '@xomda/util'
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Editor, MonacoCodeEditor, MonacoDiffEditor } from './monaco'
import { monaco } from './monaco'

export enum EventTypes {
  Init = 'init',
  UpdateModelValue = 'update:modelValue',
}

export const CodeEditor = defineComponent({
  name: 'CodeEditor',

  emits: [EventTypes.UpdateModelValue, EventTypes.Init],

  props: {
    diffEditor: { type: Boolean, default: false },
    width: { type: [String, Number], default: '100%' },
    height: { type: [String, Number], default: '100%' },
    original: { type: String },
    modelValue: { type: String },
    language: { type: String, default: 'javascript' },
    theme: { type: String, default: 'vs-dark' },
    readOnly: { type: Boolean, default: false },
    lineNumbers: { type: Boolean, default: true },
    stickyScroll: { type: Boolean, default: true },
    scrollShadows: { type: Boolean, default: false },
    options: { type: Object, default: () => ({}) },
    editorMounted: { type: Function, default: () => ({}) },
    editorBeforeMount: { type: Function, default: () => ({}) },
  },

  setup(props, { emit, attrs }) {
    const root = ref<HTMLElement>()
    const style = computed(() => ({
      width: !isNumberLike(props.width) ? props.width : `${props.width}px`,
      height: !isNumberLike(props.height) ? props.height : `${props.height}px`,
    }))

    let editor: Editor | undefined // don't make it reactive, it will freeze

    const getEditor = (): MonacoCodeEditor | null => {
      if (!editor) return null
      return props.diffEditor
        ? (editor as MonacoDiffEditor).getModifiedEditor()
        : (editor as MonacoCodeEditor)
    }

    /**
     * Read the editor's current text directly. Was previously a Vue
     * `computed` that read from a captured (non-reactive) `editor`
     * local — which meant Vue cached the first evaluation and never
     * invalidated it, so every `onDidChangeContent` after the first
     * emitted the *initial* text instead of the latest. The visible
     * symptom: only the first character a user typed propagated up,
     * subsequent keystrokes were silently dropped.
     */
    const readEditorValue = (): string => getEditor()?.getValue() ?? ''
    const writeEditorValue = (next: string) => {
      const ed = getEditor()
      if (ed && ed.getValue() !== next) ed.setValue(next)
    }

    const setDiffModel = (value: string, original: string) => {
      const { language } = props
      const originalModel = monaco.editor.createModel(original, language)
      const modifiedModel = monaco.editor.createModel(value, language)
      ;(editor as MonacoDiffEditor).setModel({
        original: originalModel,
        modified: modifiedModel,
      })
    }

    const editorOptionsBeforeMount = () => {
      const options = props.editorBeforeMount(monaco) || {}
      Object.assign(options, {
        fontFamily: 'monospace',
        fontSize: 'var(--v-font-size-root, 12)',
        minimap: { enabled: false },
        cursorSmoothCaretAnimation: 'explicit',
        enableSplitViewResizing: true,
        scrollBeyondLastLine: false,
        renderFinalNewline: 'on',
        automaticLayout: true,
        fixedOverflowWidgets: true,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          verticalSliderSize: 10,
          horizontalSliderSize: 10,
        },
      })
      return options
    }

    const editorMounted = (editor: Editor) => {
      emit(EventTypes.Init, editor)
      props.editorMounted(editor, monaco)
      if (props.diffEditor) {
        ;(editor as MonacoDiffEditor).onDidUpdateDiff(() => {
          emit(EventTypes.UpdateModelValue, readEditorValue())
        })
      } else {
        ;(editor as MonacoCodeEditor).getModel()?.onDidChangeContent(() => {
          emit(EventTypes.UpdateModelValue, readEditorValue())
        })
      }
    }

    const readOnlyOptions = () =>
      props.readOnly
        ? {
            readOnly: true,
            domReadOnly: true,
            renderLineHighlight: 'none' as const,
            occurrencesHighlight: 'off' as const,
            selectionHighlight: false,
            contextmenu: false,
          }
        : {}

    const toggleOptions = () => ({
      lineNumbers: (props.lineNumbers ? 'on' : 'off') as 'on' | 'off',
      lineNumbersMinChars: props.lineNumbers ? 3 : 0,
      lineDecorationsWidth: props.lineNumbers ? 10 : 0,
      stickyScroll: { enabled: props.stickyScroll },
      scrollbar: {
        useShadows: props.scrollShadows,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        verticalSliderSize: 10,
        horizontalSliderSize: 10,
      },
    })

    const initMonaco = () => {
      if (!root.value) return
      const { language, theme, options } = props
      const finalOptions = {
        ...options,
        ...editorOptionsBeforeMount(),
        ...toggleOptions(),
        ...readOnlyOptions(),
      }

      editor = monaco.editor[props.diffEditor ? 'createDiffEditor' : 'create'](root.value, {
        value: props.modelValue,
        language,
        theme,
        ...finalOptions,
      })
      if (props.diffEditor) setDiffModel(props.modelValue ?? '', props.original ?? '')
      editorMounted(editor)
    }

    onMounted(initMonaco)
    onBeforeUnmount(() => editor?.dispose())

    watch(
      () => props.options,
      () => {
        editor?.updateOptions(props.options)
      },
      { deep: true }
    )

    watch(
      () => props.modelValue,
      () => {
        if (!editor) return
        const next = props.modelValue ?? ''
        if (next !== readEditorValue()) writeEditorValue(next)
      }
    )

    watch(
      () => props.language,
      () => {
        if (!editor) return
        if (props.diffEditor) {
          const { original, modified } = (editor as MonacoDiffEditor).getModel()!
          monaco.editor.setModelLanguage(original, props.language)
          monaco.editor.setModelLanguage(modified, props.language)
        } else {
          monaco.editor.setModelLanguage((editor as MonacoCodeEditor).getModel()!, props.language)
        }
      }
    )
    watch(
      () => props.theme,
      () => {
        if (editor) monaco.editor.setTheme(props.theme)
      }
    )
    watch(
      () => props.readOnly,
      () => {
        editor?.updateOptions(readOnlyOptions())
      }
    )
    watch(
      () => [props.lineNumbers, props.stickyScroll, props.scrollShadows],
      () => {
        editor?.updateOptions(toggleOptions())
      }
    )
    watch(style, () => nextTick().then(() => editor?.layout()))

    return () => (
      <div
        class={['v-code-editor', 'fill-height', props.readOnly && 'v-code-editor--readonly']}
        ref={root}
        {...attrs}
        style={style.value}
      />
    )
  },
})
