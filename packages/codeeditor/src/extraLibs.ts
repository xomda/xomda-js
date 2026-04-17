export type ExtraLibLanguage = 'javascript' | 'typescript'

/**
 * Register an ambient `.d.ts` source with Monaco's language service.
 * Calling again with the same `filePath` replaces the previous registration.
 *
 * Loads `./monaco` dynamically so callers that only need to *queue* an
 * extra-lib (e.g. at template-editor mount, before any CodeEditor is on
 * screen) don't drag the full monaco-editor bundle into the main chunk.
 * Sequencing with CodeEditor mount is preserved because both share the
 * same module-cached promise chunk.
 */
export function addExtraLib(
  content: string,
  filePath: string,
  language: ExtraLibLanguage = 'javascript'
): void {
  void import('./monaco').then(({ monaco }) => {
    // @ts-expect-error monaco's bundled types mark `typescript` as deprecated; runtime API is present
    const defaults = monaco.languages.typescript[`${language}Defaults`]
    defaults.addExtraLib(content, filePath)
  })
}
