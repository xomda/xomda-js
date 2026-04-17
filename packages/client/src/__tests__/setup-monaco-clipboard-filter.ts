/**
 * Test setup — neutralise Monaco's `installWebKitWriteTextWorkaround`
 * unhandled-rejection leak.
 *
 * `monaco-editor` is eagerly imported by `@xomda/codeeditor`, which the
 * client bundle pulls in transitively. On every `click` against `<body>`
 * Monaco's `BrowserClipboardService.installWebKitWriteTextWorkaround`
 * (clipboardService.js) creates a fresh `DeferredPromise`, cancels the
 * previous one, and passes the inner promise (`currentWritePromise.p`)
 * straight into `new ClipboardItem({ 'text/plain': … })`. The outer
 * `navigator.clipboard.write(...)` call has a `.catch`, but the INNER
 * promise does not — so when the next click cancels it, the rejection
 * is unhandled. happy-dom faithfully reports the rejection; vitest then
 * tallies it as `Errors 1 error` even when every test passes
 * (GenerateView.spec.tsx triggers this on its `Dry Run` menu click).
 *
 * In real browsers this race is invisible because the page never closes
 * fast enough to surface the cancellation, and devtools' unhandled-
 * rejection trap filters it via Monaco's own bundled error reporter.
 *
 * The stub installs a `ClipboardItem` shim that attaches a
 * silent `.catch(() => {})` to every promise value it receives. The
 * cancellation now has a downstream handler and never reaches the
 * unhandled-rejection trap. Real `navigator.clipboard` semantics are
 * preserved — the shim only intercepts the constructor.
 *
 * Scope: runs ONCE per test process (vitest workers each load this
 * setup). Idempotent: re-applying the patch is a no-op.
 */

interface ClipboardItemLike {
  new (items: Record<string, unknown>): unknown
}

const g = globalThis as unknown as {
  ClipboardItem?: ClipboardItemLike
  __xomdaClipboardItemPatched?: boolean
}

if (!g.__xomdaClipboardItemPatched) {
  g.__xomdaClipboardItemPatched = true

  const original = g.ClipboardItem
  class ShimmedClipboardItem {
    constructor(items: Record<string, unknown>) {
      for (const value of Object.values(items)) {
        // Any thenable value gets a silent .catch attached. This makes the
        // inner DeferredPromise's cancellation rejection "handled" so the
        // process-wide unhandled-rejection trap never fires.
        if (
          value !== null &&
          typeof value === 'object' &&
          'then' in value &&
          typeof (value as { then: unknown }).then === 'function'
        ) {
          ;(value as Promise<unknown>).catch(() => {})
        }
      }
      // Delegate to the original if one exists (happy-dom may or may not
      // provide it) so any real consumers still see the right type. The
      // monkey-patch is purely additive for our needs.
      if (original) {
        try {
          return new original(items) as object
        } catch {
          // Original constructor rejected the shape; return ourselves.
        }
      }
      return this
    }
  }
  g.ClipboardItem = ShimmedClipboardItem as ClipboardItemLike
}
