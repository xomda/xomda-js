import { defineStore } from 'pinia'

export type NotificationKind = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: number
  kind: NotificationKind
  message: string
  /**
   * Auto-dismiss timeout in ms. 0 = sticky (user must dismiss).
   * Default 4 s for info/success, 6 s for warning, 8 s for error.
   */
  timeout: number
  /** Optional action button (e.g. "Retry"). */
  action?: { label: string; run: () => void | Promise<void> }
  /**
   * Times this notification has been pushed back-to-back. The host renders
   * `n× ` in front of the message when this is >1. Internal — set by the
   * store, not by callers.
   */
  count: number
  /** Wall-clock ms when the notification was first pushed. */
  createdAt: number
}

export interface NotifyOptions {
  timeout?: number
  action?: Notification['action']
  /**
   * Treat repeated identical `(kind, message)` pushes as a single
   * notification and bump its `count` + reset its dismiss timer. Default
   * `true`. Turn off when the caller genuinely needs N independent
   * notifications (e.g. a bulk-action progress log).
   */
  dedupe?: boolean
}

const DEFAULT_TIMEOUT: Record<NotificationKind, number> = {
  info: 4000,
  success: 4000,
  warning: 6000,
  error: 8000,
}

/**
 * Centralised user-facing notification surface.
 *
 * Every part of the app that needs to tell the user something — a mutation
 * failed, a save succeeded, a connection dropped — pushes through this store.
 * The single `<NotificationHost>` component mounted in `App.tsx` renders them.
 *
 * Defaults are opinionated so callers don't have to think:
 * - errors stay around longer (8 s) than info/success (4 s) and warning (6 s)
 * - `timeout: 0` makes a notification sticky for actions that need a Retry click
 * - identical `(kind, message)` pushes deduplicate by default — the host shows
 *   `3× Save failed` instead of three identical toasts. Set `dedupe: false`
 *   when the caller wants distinct entries (bulk progress, logs, etc.)
 *
 * Pair with `useMutation` to surface tRPC failures automatically.
 */
const HISTORY_CAPACITY = 200

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as Notification[],
    /**
     * Bounded ring buffer of notifications the user has seen (whether
     * dismissed manually or auto-timed-out). The Notification Center
     * renders this so users can review what they missed. Newest last.
     */
    history: [] as Notification[],
    /**
     * Monotonically-increasing id counter. Lives in state (not module scope)
     * so `setActivePinia(createPinia())` between tests yields a fresh
     * sequence — otherwise ids leak across test boundaries and dedup
     * lookups can match stale entries from earlier tests.
     */
    nextId: 1,
  }),
  actions: {
    push(kind: NotificationKind, message: string, options: NotifyOptions = {}): number {
      const dedupe = options.dedupe ?? true
      const timeout = options.timeout ?? DEFAULT_TIMEOUT[kind]

      if (dedupe) {
        const existing = this.items.find((n) => n.kind === kind && n.message === message)
        if (existing) {
          existing.count += 1
          // Reset the timer so the dedup'd message keeps showing.
          existing.timeout = timeout
          // Adopt the latest action if the caller provided one.
          if (options.action) existing.action = options.action
          return existing.id
        }
      }

      const id = this.nextId++
      this.items.push({
        id,
        kind,
        message,
        timeout,
        action: options.action,
        count: 1,
        createdAt: Date.now(),
      })
      return id
    },
    info(message: string, options?: NotifyOptions) {
      return this.push('info', message, options)
    },
    success(message: string, options?: NotifyOptions) {
      return this.push('success', message, options)
    },
    warning(message: string, options?: NotifyOptions) {
      return this.push('warning', message, options)
    },
    error(message: string, options?: NotifyOptions) {
      return this.push('error', message, options)
    },
    dismiss(id: number) {
      const item = this.items.find((n) => n.id === id)
      if (item) {
        // Archive into history (bounded). Action is intentionally dropped —
        // it's bound to live state (e.g. a tRPC retry handle) that may not
        // be valid later.
        this.history.push({ ...item, action: undefined, timeout: 0 })
        if (this.history.length > HISTORY_CAPACITY) {
          this.history.splice(0, this.history.length - HISTORY_CAPACITY)
        }
      }
      this.items = this.items.filter((n) => n.id !== id)
    },
    clear() {
      this.items = []
    },
    clearHistory() {
      this.history = []
    },
  },
})

export type NotificationsStore = ReturnType<typeof useNotificationsStore>
