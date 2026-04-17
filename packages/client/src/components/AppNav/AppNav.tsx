import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DarkModeIcon,
  FolderIcon,
  GenerateIcon,
  HistoryIcon,
  HomeIcon,
  LightModeIcon,
  ModelIcon,
  TemplatesIcon,
} from '@xomda/icons'
import { useLocalStorageStore } from '@xomda/ui'
import { computed, defineComponent, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VCard, VIcon, VTooltip } from 'vuetify/components'

import styles from './AppNav.module.scss'

const NAV_WIDTH_COLLAPSED = 56
const NAV_WIDTH_EXPANDED = 200

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

    watchEffect(() => {
      const w = expanded.value ? NAV_WIDTH_EXPANDED : NAV_WIDTH_COLLAPSED
      document.documentElement.style.setProperty('--appnav-width', `${w}px`)
    })

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
              <VIcon icon={store.darkMode ? LightModeIcon : DarkModeIcon} size="18" />
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
                    <VIcon icon={store.darkMode ? LightModeIcon : DarkModeIcon} size="18" />
                  </button>
                ),
              }}
            </VTooltip>
          )
        })()}
        <button
          class={styles.toggleBtn}
          onClick={() => (expanded.value = !expanded.value)}
          aria-label={expanded.value ? 'Collapse navigation' : 'Expand navigation'}
        >
          <VIcon icon={expanded.value ? ChevronLeftIcon : ChevronRightIcon} size="18" />
        </button>
      </VCard>
    )
  },
})
