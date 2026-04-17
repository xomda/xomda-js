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

// monaco-editor's bundled types mark `languages.typescript` as deprecated
// (typed as `{ deprecated: true }`) — see `extraLibs.ts:14` for the
// matching shim. The runtime API is still in place and is the supported
// path for the standalone editor (the deprecation is for the web-mode
// integration, which we don't use). Revisit when monaco-editor's typings
// surface `typescriptDefaults` again or when we switch to LSP-mode.
// @ts-expect-error monaco-editor: typescriptDefaults runtime-present, type marked deprecated
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)

// Custom themes that match Vuetify's `--v-theme-surface` so the editor
// blends with surrounding cards. Update if the Vuetify surface changes.
monaco.editor.defineTheme('xomda-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#FFFFFF' },
})
monaco.editor.defineTheme('xomda-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#1B1E26' },
})

export { monaco }
