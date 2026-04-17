import { useNotificationsStore } from '@xomda/ui'
import { setLogSink } from '@xomda/util'

import { registerModule } from '../registry'

registerModule({
  id: 'logs',
  routes: [
    {
      path: '/logs',
      name: 'logs',
      component: () => import('./LogsView').then(({ LogsView }) => LogsView),
    },
  ],
  // No `nav` entry — the Logs button lives in `AppNav`'s bottom rail
  // (between dark-mode and Preferences) until it finds a permanent home.
  setup() {
    // Bridge: logger entries flagged `attention: true` become user-facing
    // notifications automatically. The store is safe to use here because
    // `initializeModules()` runs after Pinia is active (see main.ts).
    const store = useNotificationsStore()
    setLogSink((entry) => {
      if (!entry.attention) return
      const kind =
        entry.level === 'error'
          ? 'error'
          : entry.level === 'warn'
            ? 'warning'
            : entry.level === 'info'
              ? 'info'
              : 'info'
      store.push(kind, `[${entry.source}] ${entry.message}`)
    })
  },
})
