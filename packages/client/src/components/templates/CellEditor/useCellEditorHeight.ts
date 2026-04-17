import type { Editor, MonacoCodeEditor } from '@xomda/codeeditor'
import { useLocalStorageStore } from '@xomda/ui'
import { ref } from 'vue'

const MIN_H = 80
const MAX_H = 600
const DEFAULT_H = 120
const AUTO_FIT_PADDING = 8

function clampHeight(value: number): number {
  return Math.max(MIN_H, Math.min(MAX_H, value))
}

export function useCellEditorHeight(uuid: string) {
  const store = useLocalStorageStore()
  const storedHeight = store.cellHeights[uuid]
  const height = ref(storedHeight ?? DEFAULT_H)
  let autoFitDone = storedHeight != null

  function onResize(delta: number) {
    const next = clampHeight(height.value + delta)
    if (next === height.value) return
    height.value = next
    store.cellHeights = { ...store.cellHeights, [uuid]: next }
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

  return { height, onResize, onEditorInit }
}
