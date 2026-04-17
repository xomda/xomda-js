import { watch } from 'vue'

/**
 * Resets the preview's scroll container to the top whenever the
 * rendered document changes.
 *
 * Lives outside `MarkdownPreview.tsx` so the behaviour can be
 * unit-tested under the markdown package's node-only Vitest setup —
 * matching the existing `link-handler.ts` split that keeps the JSX
 * file out of the test runner.
 *
 * Why we need this: Vue reuses the same `MarkdownPreview` instance
 * across file navigations (the host swaps `path` + `text` props but
 * the component type is unchanged), so the `.md-preview` scroll
 * container keeps the previous file's `scrollTop`. Following a link
 * to another doc should land the reader at the top of the new file,
 * not at the scroll position carried over from the previous one.
 *
 * Why a watcher on `path` (not on `text`): in-place edits to the
 * same file change `text` but should preserve the reader's scroll
 * position. Only a navigation — i.e. the file path changed — should
 * jump back to the top.
 */
export function resetScrollOnPathChange(
  getPath: () => string,
  getEl: () => { scrollTop: number } | null
): void {
  watch(getPath, () => {
    const el = getEl()
    if (el) el.scrollTop = 0
  })
}
