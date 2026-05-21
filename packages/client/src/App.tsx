import {
  CANVAS_GRID_SNAP_KEY,
  CANVAS_INERTIA_KEY,
  CANVAS_MODE_KEY,
  CANVAS_PAN_X_KEY,
  CANVAS_PAN_Y_KEY,
  CANVAS_ZOOM_KEY,
} from '@xomda/diagram'
import {
  AuroraBackground,
  ConfirmDialogHost,
  ContextMenuHost,
  NotificationHost,
  PromptDialogHost,
  UnsavedChangesDialogHost,
  useLocalStorageStore,
} from '@xomda/ui'
import { defineComponent, onMounted, provide, toRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useTheme } from 'vuetify'
import { VApp, VMain } from 'vuetify/components'

import { AppMeta } from './AppMeta'
import { AppNav } from './components'
import { useWorkspaceStore } from './stores'

export const App = defineComponent({
  name: 'App',
  setup() {
    const theme = useTheme()
    const store = useLocalStorageStore()
    const workspace = useWorkspaceStore()

    // Single workspace fetch at app mount. Idempotent on HMR re-mounts: the
    // `loaded` flag short-circuits redundant refetches so the title-bar
    // selector doesn't flicker every time `App` re-runs in dev.
    onMounted(() => {
      if (!workspace.loaded) void workspace.load()
    })

    // Single source of truth for the diagram canvas viewport: the
    // preferences store. The diagram package injects via these keys so
    // it never touches localStorage itself (which would race with this
    // store). One injection per viewport axis keeps the diagram package
    // free of any Pinia or `@xomda/ui` dependency.
    provide(CANVAS_ZOOM_KEY, toRef(store, 'diagramZoom'))
    provide(CANVAS_PAN_X_KEY, toRef(store, 'diagramPanX'))
    provide(CANVAS_PAN_Y_KEY, toRef(store, 'diagramPanY'))
    provide(CANVAS_INERTIA_KEY, toRef(store, 'diagramInertia'))
    provide(CANVAS_MODE_KEY, toRef(store, 'diagramCanvasMode'))
    provide(CANVAS_GRID_SNAP_KEY, toRef(store, 'diagramGridSnap'))

    watch(
      () => store.darkMode,
      (val) => theme.change(val ? 'dark' : 'light'),
      { immediate: true }
    )

    return () => (
      <VApp>
        <AppMeta />
        <AppNav />
        <VMain
          class={['h-screen']}
          style={{
            paddingLeft: 'calc(var(--appnav-width, 56px) + 16px)',
            position: 'relative',
            isolation: 'isolate',
          }}
        >
          <AuroraBackground intensity={0.4} animationSpeed={0.5} opacity={0.3} blur={40} />
          <RouterView />
        </VMain>
        <ConfirmDialogHost />
        <PromptDialogHost />
        <UnsavedChangesDialogHost />
        <ContextMenuHost />
        <NotificationHost />
      </VApp>
    )
  },
})
