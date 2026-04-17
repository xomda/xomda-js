import { CloseIcon } from '@xomda/icons'
import { defineComponent, onBeforeUnmount, watch } from 'vue'
import { VBtn } from 'vuetify/components'

import {
  type Notification,
  type NotificationKind,
  useNotificationsStore,
} from '../../stores/notifications'
import styles from './NotificationHost.module.scss'

const POLITENESS: Record<NotificationKind, 'polite' | 'assertive'> = {
  info: 'polite',
  success: 'polite',
  warning: 'assertive',
  error: 'assertive',
}

const KIND_CLASS: Record<NotificationKind, string> = {
  info: styles.toastInfo,
  success: styles.toastSuccess,
  warning: styles.toastWarning,
  error: styles.toastError,
}

interface DismissTimers {
  schedule: (n: Notification) => void
  cancel: (id: number) => void
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
 * root. Stacks notifications bottom-right; each one auto-dismisses after
 * its `timeout` (or sticks if `timeout=0`).
 *
 * Visual: dense toasts with a coloured left border per severity — no
 * tinted background, no oversized padding. Dismissed entries flow into
 * the store's `history` ring buffer so the user can review them in the
 * Notification Center.
 */
export const NotificationHost = defineComponent({
  name: 'NotificationHost',
  setup() {
    const store = useNotificationsStore()

    const timers = createTimers((id) => store.dismiss(id))

    watch(
      () => store.items.map((n) => ({ id: n.id, count: n.count, timeout: n.timeout })),
      (curr, prev) => {
        const prevMap = new Map((prev ?? []).map((p) => [p.id, p]))
        for (const c of curr) {
          const p = prevMap.get(c.id)
          if (!p) {
            const item = store.items.find((i) => i.id === c.id)
            if (item) timers.schedule(item)
          } else if (p.count !== c.count || p.timeout !== c.timeout) {
            const item = store.items.find((i) => i.id === c.id)
            if (item) timers.refresh(item)
          }
        }
        const currIds = new Set(curr.map((c) => c.id))
        for (const p of prevMap.keys()) {
          if (!currIds.has(p)) timers.cancel(p)
        }
      },
      { deep: true, flush: 'post', immediate: true }
    )

    onBeforeUnmount(() => timers.clearAll())

    function renderToast(n: Notification) {
      return (
        <div
          key={n.id}
          class={[styles.toast, KIND_CLASS[n.kind]]}
          role={n.kind === 'error' || n.kind === 'warning' ? 'alert' : 'status'}
        >
          <div class={styles.body}>
            {n.count > 1 && <span class={styles.count}>{n.count}×</span>}
            <span class={styles.message}>{n.message}</span>
          </div>
          <div class={styles.actions}>
            {n.action && (
              <VBtn
                variant="text"
                density="compact"
                size="small"
                onClick={async () => {
                  timers.cancel(n.id)
                  try {
                    await n.action!.run()
                  } catch (err) {
                    const message = err instanceof Error ? err.message : String(err)
                    store.error(`Action failed: ${message}`)
                  } finally {
                    store.dismiss(n.id)
                  }
                }}
              >
                {n.action.label}
              </VBtn>
            )}
            <VBtn
              icon={CloseIcon}
              variant="text"
              density="compact"
              size="small"
              aria-label="Dismiss notification"
              onClick={() => {
                timers.cancel(n.id)
                store.dismiss(n.id)
              }}
            />
          </div>
        </div>
      )
    }

    return () => {
      const politeText: string[] = []
      const assertiveText: string[] = []
      for (const n of store.items) {
        const text = (n.count > 1 ? `${n.count}× ` : '') + n.message
        if (POLITENESS[n.kind] === 'assertive') assertiveText.push(text)
        else politeText.push(text)
      }

      return (
        <div class={styles.host}>
          {store.items.map(renderToast)}
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
