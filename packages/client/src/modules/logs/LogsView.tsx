import { DeleteIcon, NotificationsIcon, OutputIcon } from '@xomda/icons'
import type { Notification } from '@xomda/ui'
import { useNotificationsStore, usePoll } from '@xomda/ui'
import type { LogEntry, LogLevel } from '@xomda/util'
import { clearLogs, getRecentLogs } from '@xomda/util'
import { computed, defineComponent, ref } from 'vue'
import { VBtn, VEmptyState, VTab, VTabs } from 'vuetify/components'

import { AppTitleBar } from '../../components'
import styles from './LogsView.module.scss'

const KIND_TO_LEVEL: Record<Notification['kind'], LogLevel> = {
  info: 'info',
  success: 'info',
  warning: 'warn',
  error: 'error',
}

type Tab = 'notifications' | 'logs'

function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${d.toLocaleTimeString(undefined, { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

/**
 * Combined view of recent user-facing notifications and structured logger
 * output. Mirrors VS Code's "Output" / "Notifications" panel: a single
 * destination the user can open when something needs investigating.
 */
export const LogsView = defineComponent({
  name: 'LogsView',
  setup() {
    const store = useNotificationsStore()
    const tab = ref<Tab>('notifications')
    // Logger is module-level state; poll it. The ring is at most 1k entries
    // so each snapshot is cheap, and `usePoll` auto-pauses on hidden tabs.
    const { data: logs, refresh: refreshLogs } = usePoll(() => [...getRecentLogs()], 1000)

    const history = computed(() =>
      // Newest first — easier for users scanning what just happened.
      [...store.history].reverse()
    )
    const logsReversed = computed(() => [...(logs.value ?? [])].reverse())

    function renderNotificationRow(n: Notification) {
      const level = KIND_TO_LEVEL[n.kind]
      return (
        <div key={n.id} class={[styles.row, styles[level]]}>
          <span>{formatTime(n.createdAt ?? Date.now())}</span>
          <span class={styles.rowKind}>{n.kind}</span>
          <span class={styles.rowSource}>{n.count > 1 ? `${n.count}×` : ''}</span>
          <span class={styles.rowMessage}>{n.message}</span>
        </div>
      )
    }

    function renderLogRow(e: LogEntry) {
      return (
        <div key={e.id} class={[styles.row, styles[e.level]]}>
          <span>{formatTime(e.timestamp)}</span>
          <span class={styles.rowKind}>{e.level}</span>
          <span class={styles.rowSource}>{e.source}</span>
          <span class={styles.rowMessage}>{e.message}</span>
        </div>
      )
    }

    function onClear() {
      if (tab.value === 'notifications') store.clearHistory()
      else {
        clearLogs()
        // Pull the now-empty ring immediately so the UI doesn't wait for
        // the next poll tick.
        void refreshLogs()
      }
    }

    const clearDisabled = computed(() =>
      tab.value === 'notifications' ? history.value.length === 0 : (logs.value?.length ?? 0) === 0
    )

    return () => (
      <div class={styles.view}>
        <AppTitleBar>
          {{
            title: () => 'Notifications & Logs',
            actions: () => (
              <VBtn
                prepend-icon={DeleteIcon}
                variant="text"
                density="comfortable"
                disabled={clearDisabled.value}
                onClick={onClear}
              >
                Clear
              </VBtn>
            ),
          }}
        </AppTitleBar>

        <VTabs
          modelValue={tab.value}
          onUpdate:modelValue={(v: unknown) => (tab.value = v as Tab)}
          density="compact"
          color="primary"
          sliderColor="primary"
          class={[styles.tabs, 'mt-2']}
        >
          <VTab value="notifications" prepend-icon={NotificationsIcon}>
            Notifications ({history.value.length})
          </VTab>
          <VTab value="logs" prepend-icon={OutputIcon}>
            Logs ({logs.value?.length ?? 0})
          </VTab>
        </VTabs>

        <div class={styles.list}>
          {tab.value === 'notifications' ? (
            history.value.length === 0 ? (
              <VEmptyState
                icon={NotificationsIcon}
                title="No notifications yet"
                text="User-facing notifications will appear here as the app surfaces them."
                class={styles.empty}
              />
            ) : (
              history.value.map(renderNotificationRow)
            )
          ) : logsReversed.value.length === 0 ? (
            <VEmptyState
              icon={OutputIcon}
              title="No log entries yet"
              text="Structured logger output will appear here as the app produces it."
              class={styles.empty}
            />
          ) : (
            logsReversed.value.map(renderLogRow)
          )}
        </div>
      </div>
    )
  },
})
