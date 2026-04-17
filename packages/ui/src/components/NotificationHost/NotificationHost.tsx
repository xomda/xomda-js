import { defineComponent, onBeforeUnmount, watch } from 'vue'
import { VBtn, VSnackbar } from 'vuetify/components'

import {
  type Notification,
  type NotificationKind,
  useNotificationsStore,
} from '../../stores/notifications'
import styles from './NotificationHost.module.scss'

/**
 * Politeness per kind. WCAG: errors and warnings interrupt the screen
 * reader's queue (`assertive`); info/success do not (`polite`). Two
 * separate live regions are required because `aria-live` is a property
 * of the region, not the element — toggling it dynamically isn't
 * reliably re-announced.
 */
const POLITENESS: Record<NotificationKind, 'polite' | 'assertive'> = {
  info: 'polite',
  success: 'polite',
  warning: 'assertive',
  error: 'assertive',
}

interface DismissTimers {
  schedule: (n: Notification) => void
  cancel: (id: number) => void
  /** Reset the timer to use the latest timeout — for dedup hits. */
  refresh: (n: Notification) => void
  clearAll: () => void
}

function createTimers(onTimeout: (id: number) => void): DismissTimers {
  const handles = new Map<number, ReturnType<typeof setTimeout>>()
  const schedule = (n: Notification) => {
    if (n.timeout <= 0) return
    if (handles.has(n.id)) return
    const h = setTimeout(() => {
      handles.delete(n.id)
      onTimeout(n.id)
    }, n.timeout)
    handles.set(n.id, h)
  }
  const cancel = (id: number) => {
    const h = handles.get(id)
    if (h) clearTimeout(h)
    handles.delete(id)
  }
  const refresh = (n: Notification) => {
    cancel(n.id)
    schedule(n)
  }
  const clearAll = () => {
    for (const h of handles.values()) clearTimeout(h)
    handles.clear()
  }
  return { schedule, cancel, refresh, clearAll }
}

/**
 * Single visual surface for `useNotificationsStore`. Mount once at the app
 * root next to `ConfirmDialogHost`. Stacks notifications bottom-right;
 * each one auto-dismisses after its `timeout` (or sticks if `timeout=0`).
 *
 * Two ARIA live regions back the screen-reader experience:
 * - `aria-live="polite"` for info/success — read when the user is idle.
 * - `aria-live="assertive"` for warning/error — interrupts immediately.
 *
 * Dedup'd notifications render with a leading count badge (`3× …`).
 */
export const NotificationHost = defineComponent({
  name: 'NotificationHost',
  setup() {
    const store = useNotificationsStore()

    const timers = createTimers((id) => store.dismiss(id))

    // Subscribe to the items list. `flush: 'post'` runs after the DOM is
    // updated so we never schedule timers during render.
    watch(
      () => store.items.map((n) => ({ id: n.id, count: n.count, timeout: n.timeout })),
      (curr, prev) => {
        const prevMap = new Map((prev ?? []).map((p) => [p.id, p]))
        for (const c of curr) {
          const p = prevMap.get(c.id)
          if (!p) {
            // Newly arrived.
            const item = store.items.find((i) => i.id === c.id)
            if (item) timers.schedule(item)
          } else if (p.count !== c.count || p.timeout !== c.timeout) {
            // Dedup hit or timeout override on an existing entry — refresh.
            const item = store.items.find((i) => i.id === c.id)
            if (item) timers.refresh(item)
          }
        }
        // Anything that vanished from the store is also cancelled.
        const currIds = new Set(curr.map((c) => c.id))
        for (const p of prevMap.keys()) {
          if (!currIds.has(p)) timers.cancel(p)
        }
      },
      { deep: true, flush: 'post', immediate: true }
    )

    onBeforeUnmount(() => timers.clearAll())

    function renderItem(n: Notification) {
      const prefix = n.count > 1 ? `${n.count}× ` : ''
      return (
        <VSnackbar
          key={n.id}
          modelValue={true}
          color={n.kind}
          timeout={-1}
          location="bottom right"
          class={styles.snackbar}
          onUpdate:modelValue={(v: boolean) => {
            if (!v) {
              timers.cancel(n.id)
              store.dismiss(n.id)
            }
          }}
        >
          {{
            default: () => (
              <span class={styles.message}>
                {prefix}
                {n.message}
              </span>
            ),
            actions: () => (
              <>
                {n.action ? (
                  <VBtn
                    variant="text"
                    density="comfortable"
                    onClick={async () => {
                      timers.cancel(n.id)
                      try {
                        await n.action!.run()
                      } catch (err) {
                        // The action's own failure is the caller's concern —
                        // not the notification host's. Surface it once via the
                        // store rather than crashing Vue's event loop. The
                        // replacement notification keeps the original kind's
                        // default timeout so users see it long enough to read.
                        const message = err instanceof Error ? err.message : String(err)
                        store.error(`Action failed: ${message}`)
                      } finally {
                        store.dismiss(n.id)
                      }
                    }}
                  >
                    {n.action.label}
                  </VBtn>
                ) : null}
                <VBtn
                  icon="$close"
                  variant="text"
                  density="comfortable"
                  aria-label="Dismiss notification"
                  onClick={() => {
                    timers.cancel(n.id)
                    store.dismiss(n.id)
                  }}
                />
              </>
            ),
          }}
        </VSnackbar>
      )
    }

    return () => {
      // Two parallel structures:
      // 1. The visual snackbars — Vuetify teleports them to the document body,
      //    so they live OUTSIDE our wrapper. They render every item once.
      // 2. Off-screen live regions — plain text mirrors of the messages so
      //    screen readers announce them with the correct politeness per kind.
      //    Split by politeness because `aria-live` is a property of the region.
      const politeText: string[] = []
      const assertiveText: string[] = []
      for (const n of store.items) {
        const text = (n.count > 1 ? `${n.count}× ` : '') + n.message
        if (POLITENESS[n.kind] === 'assertive') assertiveText.push(text)
        else politeText.push(text)
      }

      return (
        <div class={styles.host}>
          {store.items.map(renderItem)}
          <div
            class={styles.srOnly}
            role="region"
            aria-label="Status notifications"
            aria-live="polite"
          >
            {politeText.map((t, i) => (
              <span key={`p-${i}`}>{t}</span>
            ))}
          </div>
          <div class={styles.srOnly} role="region" aria-label="Alerts" aria-live="assertive">
            {assertiveText.map((t, i) => (
              <span key={`a-${i}`}>{t}</span>
            ))}
          </div>
        </div>
      )
    }
  },
})
