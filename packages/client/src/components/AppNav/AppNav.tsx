import {
  DarkModeIcon,
  FolderIcon,
  GenerateIcon,
  HistoryIcon,
  HomeIcon,
  LightModeIcon,
  ModelIcon,
  SettingsIcon,
  TemplatesIcon,
} from '@xomda/icons'
import { useLocalStorageStore } from '@xomda/ui'
import { computed, defineComponent, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VCard, VIcon, VTooltip } from 'vuetify/components'

import styles from './AppNav.module.scss'

const NAV_WIDTH_COLLAPSED = 56
const NAV_WIDTH_EXPANDED = 200
const SNAP_THRESHOLD = 30

const navItems = [
  { id: 'home', icon: HomeIcon, path: '/', label: 'Home' },
  { id: 'model', icon: ModelIcon, path: '/model', label: 'Model' },
  { id: 'versions', icon: HistoryIcon, path: '/versions', label: 'Versions' },
  { id: 'templates', icon: TemplatesIcon, path: '/templates', label: 'Templates' },
  { id: 'generate', icon: GenerateIcon, path: '/generate', label: 'Template Generation' },
  { id: 'files', icon: FolderIcon, path: '/files', label: 'Files' },
]

/**
 * This is the Side Navigation in the application.
 */
export const AppNav = defineComponent({
  name: 'AppNav',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const store = useLocalStorageStore()

    const expanded = computed({
      get: () => store.navExpanded,
      set: (v) => (store.navExpanded = v),
    })

    const currentPath = computed(() => route.path)

    const dragging = ref(false)
    const dragDirection = ref<'neg' | 'pos' | null>(null)
    const handleVisible = ref(false)
    const handleY = ref(0)
    let dragAnchorX = 0
    let lastX = 0
    let hoverTimer: ReturnType<typeof setTimeout> | null = null

    watchEffect(() => {
      const w = expanded.value ? NAV_WIDTH_EXPANDED : NAV_WIDTH_COLLAPSED
      document.documentElement.style.setProperty('--appnav-width', `${w}px`)
    })

    function onResizePointerEnter() {
      hoverTimer = setTimeout(() => {
        handleVisible.value = true
      }, 350)
    }

    function onResizePointerLeave() {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer)
        hoverTimer = null
      }
      if (!dragging.value) {
        handleVisible.value = false
      }
    }

    function onResizePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      dragging.value = true
      handleVisible.value = true
      dragDirection.value = null
      dragAnchorX = e.clientX
      lastX = e.clientX
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    function onResizePointerMove(e: PointerEvent) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      handleY.value = e.clientY - rect.top
      if (!dragging.value) return
      const step = e.clientX - lastX
      lastX = e.clientX
      if (step !== 0) dragDirection.value = step < 0 ? 'neg' : 'pos'
      const delta = e.clientX - dragAnchorX
      if (!expanded.value && delta >= SNAP_THRESHOLD) {
        expanded.value = true
        dragAnchorX = e.clientX
      } else if (expanded.value && delta <= -SNAP_THRESHOLD) {
        expanded.value = false
        dragAnchorX = e.clientX
      }
    }

    function onResizePointerUp() {
      dragging.value = false
      dragDirection.value = null
      handleVisible.value = false
    }

    return () => (
      <VCard class={[styles.nav, expanded.value && styles.navExpanded]} elevation={4} rounded="lg">
        <nav class={styles.items}>
          {navItems.map((item) => {
            const active =
              item.path === '/'
                ? currentPath.value === '/'
                : currentPath.value === item.path || currentPath.value.startsWith(`${item.path}/`)
            const btn = (
              <button
                key={item.id}
                class={[styles.navBtn, active && styles.navBtnActive]}
                onClick={() => router.push(item.path)}
                aria-label={item.label}
              >
                <VIcon icon={item.icon} size="22" class={styles.navBtnIcon} />
                {expanded.value && <span class={styles.navBtnLabel}>{item.label}</span>}
              </button>
            )
            return expanded.value ? (
              btn
            ) : (
              <VTooltip text={item.label} location="right" key={item.id}>
                {{
                  activator: ({ props }: { props: Record<string, unknown> }) => (
                    <button
                      {...props}
                      key={item.id}
                      class={[styles.navBtn, active && styles.navBtnActive]}
                      onClick={() => router.push(item.path)}
                      aria-label={item.label}
                    >
                      <VIcon icon={item.icon} size="22" />
                    </button>
                  ),
                }}
              </VTooltip>
            )
          })}
        </nav>
        {(() => {
          const themeLabel = store.darkMode ? 'Switch to light mode' : 'Switch to dark mode'
          const themeBtn = (
            <button
              class={styles.themeToggleBtn}
              onClick={() => (store.darkMode = !store.darkMode)}
              aria-label={themeLabel}
            >
              <VIcon
                icon={store.darkMode ? LightModeIcon : DarkModeIcon}
                size="22"
                class={styles.navBtnIcon}
              />
              {expanded.value && <span class={styles.navBtnLabel}>{themeLabel}</span>}
            </button>
          )
          return expanded.value ? (
            themeBtn
          ) : (
            <VTooltip text={themeLabel} location="right">
              {{
                activator: ({ props }: { props: Record<string, unknown> }) => (
                  <button
                    {...props}
                    class={styles.themeToggleBtn}
                    onClick={() => (store.darkMode = !store.darkMode)}
                    aria-label={themeLabel}
                  >
                    <VIcon
                      icon={store.darkMode ? LightModeIcon : DarkModeIcon}
                      size="22"
                      class={styles.navBtnIcon}
                    />
                  </button>
                ),
              }}
            </VTooltip>
          )
        })()}
        {(() => {
          const settingsActive =
            currentPath.value === '/settings' || currentPath.value.startsWith('/settings/')
          const settingsBtn = (
            <button
              class={[styles.themeToggleBtn, settingsActive && styles.navBtnActive]}
              onClick={() => router.push('/settings')}
              aria-label="Settings"
            >
              <VIcon icon={SettingsIcon} size="22" class={styles.navBtnIcon} />
              {expanded.value && <span class={styles.navBtnLabel}>Settings</span>}
            </button>
          )
          return expanded.value ? (
            settingsBtn
          ) : (
            <VTooltip text="Settings" location="right">
              {{
                activator: ({ props }: { props: Record<string, unknown> }) => (
                  <button
                    {...props}
                    class={[styles.themeToggleBtn, settingsActive && styles.navBtnActive]}
                    onClick={() => router.push('/settings')}
                    aria-label="Settings"
                  >
                    <VIcon icon={SettingsIcon} size="22" class={styles.navBtnIcon} />
                  </button>
                ),
              }}
            </VTooltip>
          )
        })()}
        <div
          class={[
            styles.resizeDivider,
            dragging.value && styles.resizeDividerDragging,
            dragDirection.value === 'neg' && styles.resizeDividerLeft,
            dragDirection.value === 'pos' && styles.resizeDividerRight,
          ]}
          role="separator"
          aria-orientation="vertical"
          aria-label={
            expanded.value ? 'Drag left to collapse navigation' : 'Drag right to expand navigation'
          }
          onPointerenter={onResizePointerEnter}
          onPointerleave={onResizePointerLeave}
          onPointerdown={onResizePointerDown}
          onPointermove={onResizePointerMove}
          onPointerup={onResizePointerUp}
          onPointercancel={onResizePointerUp}
        >
          <div
            class={[styles.resizeHandle, handleVisible.value && styles.resizeHandleVisible]}
            style={{ top: `${handleY.value}px` }}
          />
        </div>
      </VCard>
    )
  },
})
