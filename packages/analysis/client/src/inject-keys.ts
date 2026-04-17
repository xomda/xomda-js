import type { InjectionKey } from 'vue'

/**
 * Host-provided callback for a preview component that wants to follow
 * a workspace-internal link. The host resolves `relativePath` against
 * the file the link is in (`fromPath`, project-relative), and either
 * navigates the file browser to the target — when the resolved path
 * stays inside the workspace — or surfaces an error to the user.
 *
 * Returns `true` when navigation happened, `false` when the host
 * refused (target outside the workspace, no resolver wired up).
 *
 * Provided by `FileBrowserView`; consumed by preview components like
 * `MarkdownPreview` so they don't have to know about routing or the
 * workspace boundary themselves.
 */
export type OpenWorkspaceLink = (relativePath: string, fromPath: string) => boolean

export const OpenWorkspaceLinkKey: InjectionKey<OpenWorkspaceLink> = Symbol(
  'xomda:open-workspace-link'
)
