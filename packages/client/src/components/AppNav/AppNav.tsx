import { DarkModeIcon, LightModeIcon, NotificationsIcon, SettingsIcon } from '@xomda/icons'
import { useLocalStorageStore, useNotificationsStore } from '@xomda/ui'
import { getRecentLogs } from '@xomda/util'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VBadge, VCard, VHover, VIcon, VTooltip } from 'vuetify/components'

import { getRegisteredModules, type XomdaModuleNav } from '../../modules'
import { LogsRoutes } from '../../modules/logs'
import { SettingsRoutes } from '../../modules/settings'
import styles from './AppNav.module.scss'

const NAV_WIDTH_COLLAPSED = 56
const NAV_WIDTH_EXPANDED = 200
const SNAP_THRESHOLD = 30
const HOVER_ARM_DELAY_MS = 350

interface NavItem {
  id: string
  icon: XomdaModuleNav['icon']
  routeName: string
  label: string
}

/**
 * Nav items are contributed by modules. Each module that declares a `nav`
 * entry appears in the rail, sorted by `order` (default 100).
 */
function collectNavItems(): NavItem[] {
  const items: Array<NavItem & { order: number }> = []
  for (const mod of getRegisteredModules()) {
    if (!mod.nav) continue
    items.push({
      id: mod.id,
      icon: mod.nav.icon,
      routeName: mod.nav.routeName,
      label: mod.nav.label,
      order: mod.nav.order ?? 100,
    })
  }
  items.sort((a, b) => a.order - b.order)
  return items.map(({ order: _o, ...rest }) => rest)
}

/**
 * This is the Side Navigation in the application.
 */
export const AppNav = defineComponent({
  name: 'AppNav',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const store = useLocalStorageStore()
    const notifications = useNotificationsStore()

    // Logger ring is module-level non-reactive state; poll it on a slow
    // interval so a "first log appears" event flips the badge without a
    // reload. The notification store contributions are already reactive.
    const loggerCount = ref(getRecentLogs().length)
    let logsPollHandle: ReturnType<typeof setInterval> | undefined
    onMounted(() => {
      logsPollHandle = setInterval(() => {
        loggerCount.value = getRecentLogs().length
      }, 1000)
    })
    onBeforeUnmount(() => {
      if (logsPollHandle) clearInterval(logsPollHandle)
    })
    /** True when there's anything worth surfacing in the Logs view. */
    const hasLogs = computed(
      () =>
        loggerCount.value > 0 || notifications.history.length > 0 || notifications.items.length > 0
    )

    // Collected once at component creation. Modules register at boot
    // (side-effect imports run before the router is built), so the set
    // doesn't change at runtime. If we add lazy/late registration we'll
    // make this reactive.
    const navItems = collectNavItems()

    const expanded = computed({
      get: () => store.navExpanded,
      set: (v) => (store.navExpanded = v),
    })

    // Name-based active matching: when on `/files/foo/bar`, `route.name` is
    // `'files.browse'` (the wildcard route's own name), which also matches
    // the nav item for `/files`. No path-startsWith glue needed.
    const activeRouteName = computed(() => route.name)

    const dragging = ref(false)
    const dragDirection = ref<'neg' | 'pos' | null>(null)
    const handleY = ref(0)
    let dragAnchorX = 0
    let lastX = 0

    watchEffect(() => {
      const w = expanded.value ? NAV_WIDTH_EXPANDED : NAV_WIDTH_COLLAPSED
      document.documentElement.style.setProperty('--appnav-width', `${w}px`)
    })

    function onResizePointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      dragging.value = true
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
    }

    return () => (
      <VCard class={[styles.nav, expanded.value && styles.navExpanded]} elevation={4} rounded="lg">
        <nav class={styles.items}>
          {navItems.map((item) => {
            const active = activeRouteName.value === item.routeName
            const btn = (
              <button
                key={item.id}
                class={[styles.navBtn, active && styles.navBtnActive]}
                onClick={() => router.push({ name: item.routeName })}
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
                      onClick={() => router.push({ name: item.routeName })}
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
        {hasLogs.value &&
          (() => {
            const logsActive = activeRouteName.value === LogsRoutes.view
            // VBadge wraps the icon: a small primary dot in the top-right
            // signals "there's something to look at" without stealing focus.
            // Hidden once the user navigates to /logs (treats viewing the
            // page as acknowledgement).
            const badgedIcon = (
              <VBadge dot color="primary" modelValue={!logsActive}>
                <VIcon icon={NotificationsIcon} size="22" class={styles.navBtnIcon} />
              </VBadge>
            )
            const logsBtn = (
              <button
                class={[styles.themeToggleBtn, logsActive && styles.navBtnActive]}
                onClick={() => router.push({ name: LogsRoutes.view })}
                aria-label="Notifications & Logs"
              >
                {badgedIcon}
                {expanded.value && <span class={styles.navBtnLabel}>Notifications & Logs</span>}
              </button>
            )
            return expanded.value ? (
              logsBtn
            ) : (
              <VTooltip text="Notifications & Logs" location="right">
                {{
                  activator: ({ props }: { props: Record<string, unknown> }) => (
                    <button
                      {...props}
                      class={[styles.themeToggleBtn, logsActive && styles.navBtnActive]}
                      onClick={() => router.push({ name: LogsRoutes.view })}
                      aria-label="Notifications & Logs"
                    >
                      {badgedIcon}
                    </button>
                  ),
                }}
              </VTooltip>
            )
          })()}
        {(() => {
          const settingsActive = activeRouteName.value === SettingsRoutes.view
          const settingsBtn = (
            <button
              class={[styles.themeToggleBtn, settingsActive && styles.navBtnActive]}
              onClick={() => router.push({ name: SettingsRoutes.view })}
              aria-label="Preferences"
            >
              <VIcon icon={SettingsIcon} size="22" class={styles.navBtnIcon} />
              {expanded.value && <span class={styles.navBtnLabel}>Preferences</span>}
            </button>
          )
          return expanded.value ? (
            settingsBtn
          ) : (
            <VTooltip text="Preferences" location="right">
              {{
                activator: ({ props }: { props: Record<string, unknown> }) => (
                  <button
                    {...props}
                    class={[styles.themeToggleBtn, settingsActive && styles.navBtnActive]}
                    onClick={() => router.push({ name: SettingsRoutes.view })}
                    aria-label="Preferences"
                  >
                    <VIcon icon={SettingsIcon} size="22" class={styles.navBtnIcon} />
                  </button>
                ),
              }}
            </VTooltip>
          )
        })()}
        {/* `openDelay`: VHover replaces the hand-rolled 350 ms setTimeout
            arm. The handle stays visible while dragging even if the
            pointer leaves the strip (OR'd with `dragging.value` below). */}
        <VHover openDelay={HOVER_ARM_DELAY_MS}>
          {{
            default: ({
              isHovering,
              props: hoverProps,
            }: {
              isHovering: boolean
              props: Record<string, unknown>
            }) => (
              <div
                {...hoverProps}
                class={[
                  styles.resizeDivider,
                  dragging.value && styles.resizeDividerDragging,
                  dragDirection.value === 'neg' && styles.resizeDividerLeft,
                  dragDirection.value === 'pos' && styles.resizeDividerRight,
                ]}
                role="separator"
                aria-orientation="vertical"
                aria-label={
                  expanded.value
                    ? 'Drag left to collapse navigation'
                    : 'Drag right to expand navigation'
                }
                onPointerdown={onResizePointerDown}
                onPointermove={onResizePointerMove}
                onPointerup={onResizePointerUp}
                onPointercancel={onResizePointerUp}
              >
                <div
                  class={[
                    styles.resizeHandle,
                    (isHovering || dragging.value) && styles.resizeHandleVisible,
                  ]}
                  style={{ top: `${handleY.value}px` }}
                />
              </div>
            ),
          }}
        </VHover>
      </VCard>
    )
  },
})
