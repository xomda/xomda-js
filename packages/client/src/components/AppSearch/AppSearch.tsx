import { SearchIcon } from '@xomda/icons'
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  Teleport,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import { VTextField } from 'vuetify/components'

import styles from './AppSearch.module.scss'
import {
  createModelProvider,
  createTemplateProvider,
  createVersionProvider,
  type SearchHit,
} from './providers'
import { SearchResultsPanel } from './SearchResultsPanel'
import { useAppSearch } from './useAppSearch'

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

interface PanelPos {
  top: number
  right: number
  width: number
}

export const AppSearch = defineComponent({
  name: 'AppSearch',
  setup() {
    const router = useRouter()
    const wrapRef = ref<HTMLElement | null>(null)
    const panelRef = ref<HTMLElement | null>(null)
    const focused = ref(false)
    const activeIndex = ref(0)
    const panelPos = ref<PanelPos | null>(null)

    const providers = [
      createModelProvider(router, () => closeAndReset()),
      createTemplateProvider(router, () => closeAndReset()),
      createVersionProvider(router, () => closeAndReset()),
    ]

    const { query, groups, loading, error, refresh, reset } = useAppSearch({ providers })

    const flatHits = computed<SearchHit[]>(() => groups.value.flatMap((g) => g.hits))

    const showPanel = computed(() => focused.value && query.value.trim().length > 0)

    const focusInput = (): void => {
      const el = wrapRef.value?.querySelector('input') as HTMLInputElement | null
      el?.focus()
      el?.select()
    }

    const blurInput = (): void => {
      const el = wrapRef.value?.querySelector('input') as HTMLInputElement | null
      el?.blur()
    }

    const closeAndReset = (): void => {
      focused.value = false
      activeIndex.value = 0
      reset()
      blurInput()
    }

    const move = (delta: number): void => {
      const n = flatHits.value.length
      if (n === 0) return
      activeIndex.value = (activeIndex.value + delta + n) % n
    }

    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (query.value || focused.value) {
          e.preventDefault()
          closeAndReset()
        }
        return
      }
      if (!showPanel.value || flatHits.value.length === 0) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          move(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          move(-1)
          break
        case 'PageDown':
          e.preventDefault()
          move(10)
          break
        case 'PageUp':
          e.preventDefault()
          move(-10)
          break
        case 'Home':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            activeIndex.value = 0
          }
          break
        case 'End':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            activeIndex.value = flatHits.value.length - 1
          }
          break
        case 'Enter': {
          e.preventDefault()
          const hit = flatHits.value[activeIndex.value]
          if (hit) hit.navigate()
          break
        }
        case 'Tab':
          e.preventDefault()
          closeAndReset()
          break
      }
    }

    const onSelect = (idx: number): void => {
      const hit = flatHits.value[idx]
      if (hit) hit.navigate()
    }

    const onHover = (idx: number): void => {
      activeIndex.value = idx
    }

    const recomputePanelPos = (): void => {
      const r = wrapRef.value?.getBoundingClientRect()
      if (!r) {
        panelPos.value = null
        return
      }
      panelPos.value = {
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
        width: Math.max(r.width, 360),
      }
    }

    const onFocus = (): void => {
      focused.value = true
      recomputePanelPos()
      void refresh()
    }

    const onBlur = (e: FocusEvent): void => {
      // Keep panel open when focus moves into the panel itself (e.g. clicking a row).
      const next = e.relatedTarget as Node | null
      if (next && panelRef.value?.contains(next)) return
      // Defer slightly so a click on a row registers before unmount.
      setTimeout(() => {
        focused.value = false
      }, 150)
    }

    const onGlobalKeydown = (e: KeyboardEvent): void => {
      const meta = isMac() ? e.metaKey : e.ctrlKey
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        focusInput()
      }
    }

    const onWindowChange = (): void => {
      if (showPanel.value) recomputePanelPos()
    }

    onMounted(() => {
      window.addEventListener('keydown', onGlobalKeydown)
      window.addEventListener('resize', onWindowChange)
      window.addEventListener('scroll', onWindowChange, true)
    })
    onUnmounted(() => {
      window.removeEventListener('keydown', onGlobalKeydown)
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    })

    // Reset highlight when result set changes.
    watch(
      () => flatHits.value.length,
      () => {
        activeIndex.value = 0
      }
    )

    // Recompute panel position whenever it (re)opens or the wrapper width changes.
    watch(showPanel, (open) => {
      if (open) recomputePanelPos()
    })
    watch(focused, () => {
      // Width transition completes ~200ms; recompute after to track the grown size.
      setTimeout(recomputePanelPos, 220)
    })

    // Scroll the active row into view when it changes.
    watch(activeIndex, async () => {
      await nextTick()
      const row = panelRef.value?.querySelector(
        `[data-result-index="${activeIndex.value}"]`
      ) as HTMLElement | null
      row?.scrollIntoView({ block: 'nearest' })
    })

    return () => {
      const placeholder = `Search   ${isMac() ? '⌘' : 'Ctrl'}+K`
      const activeId =
        showPanel.value && flatHits.value.length > 0
          ? `app-search-result-${activeIndex.value}`
          : undefined
      const pos = panelPos.value
      return (
        <div
          ref={(el) => (wrapRef.value = el as HTMLElement | null)}
          class={[styles.wrap, focused.value && styles.wrapFocused]}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={showPanel.value}
        >
          <div class={styles.input}>
            <VTextField
              modelValue={query.value}
              onUpdate:modelValue={(v) => (query.value = String(v ?? ''))}
              prependInnerIcon={SearchIcon}
              placeholder={placeholder}
              variant="outlined"
              density="compact"
              hideDetails
              clearable
              autocomplete="off"
              onFocus={onFocus}
              onBlur={onBlur}
              onKeydown={onKeydown}
              onClick:clear={closeAndReset}
              style={{ 'margin-top': '2px' }}
              {...({
                'aria-autocomplete': 'list',
                'aria-controls': 'app-search-results',
                'aria-activedescendant': activeId,
              } as Record<string, unknown>)}
            />
          </div>
          {showPanel.value && pos && (
            <Teleport to="body">
              <div
                ref={(el) => (panelRef.value = el as HTMLElement | null)}
                style={{
                  position: 'fixed',
                  top: `${pos.top}px`,
                  right: `${pos.right}px`,
                  width: `${pos.width}px`,
                  zIndex: 1100,
                }}
              >
                <SearchResultsPanel
                  id="app-search-results"
                  groups={groups.value}
                  activeIndex={activeIndex.value}
                  loading={loading.value}
                  error={error.value}
                  query={query.value}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              </div>
            </Teleport>
          )}
        </div>
      )
    }
  },
})
