/**
 * Global test setup — replace `@xomda/codeeditor`'s `./monaco` wrapper with a
 * lightweight stub so no client test ever loads the real `monaco-editor`.
 *
 * Why: `@xomda/codeeditor` lazy-imports `./monaco` (which eagerly pulls in
 * `monaco-editor` + 5 web workers) from inside `onMounted` / `addExtraLib`.
 * Monaco can't run under happy-dom (it needs a real browser + Web Workers),
 * and its internal lazy `import()` of submodules
 * (`.../base/browser/ui/aria/aria.js` -> `dom.js`) can resolve AFTER a test's
 * happy-dom environment has been torn down. Under the parallel `pnpm -r test`
 * load that race surfaces as `EnvironmentTeardownError` / `DOMException
 * [AbortError]`, which Vitest 4 tallies as `Errors 1 error` and fails the whole
 * run even though every test passes. In isolation Monaco usually wins the race,
 * so it presented as a load-dependent flake that broke `pnpm test:all`.
 *
 * `CodeEditor.spec.tsx` mocks this same module locally with editor behaviour it
 * asserts on; that file-local `vi.mock` overrides this global one for that file.
 * This stub covers every OTHER test that transitively mounts a `CodeEditor`
 * (CellEditor, LoopCellForm, TemplateEditor, GenerateView, App, ...): they never
 * relied on real Monaco — they only suffered the teardown race.
 *
 * The path is relative to *this* file and resolves to the exact same absolute
 * module (`packages/codeeditor/src/monaco`) that `CodeEditor.tsx` imports via
 * `./monaco`, so the stub intercepts the SUT's import everywhere.
 */
import { vi } from 'vitest'

vi.mock('../../../codeeditor/src/monaco', () => {
  const noop = (): void => {}
  const disposable = { dispose: noop }

  const makeModel = () => ({
    onDidChangeContent: () => disposable,
    dispose: noop,
  })

  const makeCodeEditor = (value = '') => {
    let text = value
    const model = makeModel()
    return {
      getValue: () => text,
      setValue: (v: string) => {
        text = v
      },
      getModel: () => model,
      setModel: noop,
      updateOptions: noop,
      layout: noop,
      focus: noop,
      dispose: noop,
    }
  }

  const makeDiffEditor = (value = '') => {
    const modified = makeCodeEditor(value)
    return {
      getModifiedEditor: () => modified,
      getOriginalEditor: () => makeCodeEditor(''),
      setModel: noop,
      onDidUpdateDiff: () => disposable,
      updateOptions: noop,
      layout: noop,
      dispose: noop,
    }
  }

  // Shared object for both `javascriptDefaults` and `typescriptDefaults`
  // (extraLibs.ts indexes `languages.typescript[`${lang}Defaults`]`).
  const languageDefaults = { addExtraLib: noop, setEagerModelSync: noop }

  return {
    monaco: {
      editor: {
        create: (_root?: unknown, opts?: { value?: string }) => makeCodeEditor(opts?.value ?? ''),
        createDiffEditor: () => makeDiffEditor(''),
        createModel: () => makeModel(),
        setModelLanguage: noop,
        setTheme: noop,
        defineTheme: noop,
      },
      languages: {
        typescript: {
          javascriptDefaults: languageDefaults,
          typescriptDefaults: languageDefaults,
        },
      },
    },
  }
})
