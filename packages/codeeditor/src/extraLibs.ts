import { monaco } from './monaco'

export type ExtraLibLanguage = 'javascript' | 'typescript'

/**
 * Register an ambient `.d.ts` source with Monaco's language service.
 * Calling again with the same `filePath` replaces the previous registration.
 */
export function addExtraLib(
  content: string,
  filePath: string,
  language: ExtraLibLanguage = 'javascript'
): void {
  // @ts-expect-error monaco's bundled types mark `typescript` as deprecated; runtime API is present
  const defaults = monaco.languages.typescript[`${language}Defaults`]
  defaults.addExtraLib(content, filePath)
}
