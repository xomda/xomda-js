import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

export type MonacoCodeEditor = monaco.editor.IStandaloneCodeEditor
export type MonacoDiffEditor = monaco.editor.IStandaloneDiffEditor
export type Editor = MonacoCodeEditor | MonacoDiffEditor

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'javascript':
      case 'typescript':
        return new TypeScriptWorker()
      default:
        return new EditorWorker()
    }
  },
}

// @ts-expect-error "does not exist on type"
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)

export { monaco }
