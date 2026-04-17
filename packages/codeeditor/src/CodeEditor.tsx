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

    const getEditor = () => {
      if (!editor) return null
      return props.diffEditor ? (editor as MonacoDiffEditor)!.getModifiedEditor() : editor!
    }

    const value = computed({
      get: () => {
        const editor = getEditor()
        if (!editor) return ''
        return (editor as MonacoCodeEditor).getValue()
      },
      set: (value: string) => {
        const editor = getEditor()
        if (editor && (editor as MonacoCodeEditor).getValue() !== value) {
          ;(editor as MonacoCodeEditor).setValue(value)
        }
      },
    })

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
      })
      return options
    }

    const editorMounted = (editor: Editor) => {
      emit(EventTypes.Init, editor)
      props.editorMounted(editor, monaco)
      if (props.diffEditor) {
        ;(editor as MonacoDiffEditor).onDidUpdateDiff(() => {
          emit(EventTypes.UpdateModelValue, value.value)
        })
      } else {
        ;(editor as MonacoCodeEditor).getModel()?.onDidChangeContent(() => {
          emit(EventTypes.UpdateModelValue, value.value)
        })
      }
    }

    const initMonaco = () => {
      if (!root.value) return
      const { language, theme, options } = props
      const finalOptions = { ...options, ...editorOptionsBeforeMount() }

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
        if (editor && props.modelValue !== value.value) value.value = props.modelValue ?? ''
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
    watch(style, () => nextTick().then(() => editor?.layout()))

    return () => (
      <div class={['v-code-editor', 'fill-height']} ref={root} {...attrs} style={style.value} />
    )
  },
})
