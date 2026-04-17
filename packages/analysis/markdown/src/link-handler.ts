/**
 * Click handler for workspace-internal links inside the markdown preview.
 *
 * Lives in its own module so the helper can be unit-tested without
 * dragging the `.tsx` component (and its JSX transform) into the test
 * runner.
 *
 * Behavior:
 * - Honours modifier-click and middle-click: those still go through
 *   the anchor's `href`, which is what users expect when they want a
 *   new tab. The host callback only fires for the plain primary click.
 * - On a plain primary click, swallows default navigation and delegates
 *   to the host-provided `open` callback. The host owns workspace-
 *   boundary policy: navigate when the target resolves inside the
 *   workspace, surface an error when it doesn't.
 * - When no host callback is wired (standalone render — Storybook,
 *   tests, an embed without `FileBrowserView`), the click is a no-op
 *   and the link stays visibly inert.
 */
export function handleLocalLinkClick(
  e: MouseEvent,
  href: string,
  fromPath: string,
  open: ((href: string, fromPath: string) => boolean) | null
): void {
  if (e.defaultPrevented) return
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  open?.(href, fromPath)
}
