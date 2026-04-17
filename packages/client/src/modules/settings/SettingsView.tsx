import { FolderXomdaIcon, LockIcon, ModelIcon, PackageIcon, SettingsIcon } from '@xomda/icons'
import { useLocalStorageStore } from '@xomda/ui'
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  VAlert,
  VCard,
  VCardText,
  VCardTitle,
  VDivider,
  VIcon,
  VNumberInput,
  VProgressLinear,
  VSlider,
  VSwitch,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider } from '../../components'
import { usePanelResize } from '../../composables'
import { PluginsCard } from './PluginsCard'
import { PreferencesActionsBar } from './PreferencesActionsBar'
import { ProjectBoundariesCard } from './ProjectBoundariesCard'
import { SettingsNav, type SettingsNavItem } from './SettingsNav'
import { createPreferencesEditor, providePreferencesEditor } from './usePreferencesEditor'

const sectionAnchorId = (id: string) => `settings-section-${id}`

// Content column max width. Matches the previous `maxWidth: 720` used on
// the inner card column; keeping it as a constant lets the sticky save
// bar and the outer scroll wrapper size consistently.
const CONTENT_MAX_WIDTH = 720

/**
 * Preferences page — owns project-level toggles that don't belong on the
 * homepage. A left-rail nav lists the available sections; clicking jumps
 * to the corresponding card and pushes the section id as the URL hash
 * (e.g. `/settings#plugins`), so links share state. As the user scrolls,
 * an IntersectionObserver keeps the active item in sync.
 *
 * All edits are buffered in a shared `PreferencesEditor` (provided to
 * descendant cards via inject). The sticky `PreferencesActionsBar` at
 * the bottom of the right pane drives Save / Cancel for every section
 * at once — VS Code-style — rather than having a Save button per card.
 *
 * Project name and description are *not* edited here; they live on the
 * homepage hero (click the title) so they feel like the project's
 * identity rather than a setting buried in a form.
 */
export const SettingsView = defineComponent({
  name: 'SettingsView',
  setup() {
    const route = useRoute()
    const router = useRouter()

    const editor = createPreferencesEditor()
    providePreferencesEditor(editor)
    const prefs = useLocalStorageStore()

    const sections = computed<SettingsNavItem[]>(() => {
      const list: SettingsNavItem[] = [
        { id: 'sandbox', label: 'File-system sandbox', icon: LockIcon },
        { id: 'diagram', label: 'Diagram', icon: ModelIcon },
      ]
      if (editor.projectExists.value) {
        list.push({ id: 'boundaries', label: 'Project boundaries', icon: FolderXomdaIcon })
        list.push({ id: 'plugins', label: 'Plugins', icon: PackageIcon })
      }
      return list
    })

    const activeId = ref<string>('sandbox')
    const scrollContainer = ref<HTMLElement | null>(null)
    // True while a programmatic click-scroll is in flight. The
    // IntersectionObserver fires every frame during a smooth scroll and would
    // otherwise repeatedly overwrite the user's intended target with whichever
    // section is briefly the most-visible mid-flight.
    const suppressObserver = ref(false)
    let observer: IntersectionObserver | null = null

    const hashFromRoute = () => {
      const raw = typeof route.hash === 'string' ? route.hash.replace(/^#/, '') : ''
      return raw && sections.value.some((s) => s.id === raw) ? raw : ''
    }

    const scrollToSection = (id: string, behavior: ScrollBehavior = 'smooth') => {
      // Always reflect the user's selection in the nav, even if the section
      // element hasn't mounted yet (e.g. projectExists hasn't flipped, so
      // the Plugins anchor isn't in the DOM). The scrollIntoView call is
      // best-effort.
      suppressObserver.value = true
      activeId.value = id
      const el = document.getElementById(sectionAnchorId(id))
      if (el) el.scrollIntoView({ behavior, block: 'start' })
      // Resume observer updates once the smooth scroll has settled. 400ms is
      // longer than the default smooth-scroll animation in every browser we
      // ship to, so the observer won't fire from in-flight intersections.
      window.setTimeout(() => {
        suppressObserver.value = false
      }, 400)
      return el != null
    }

    const selectSection = (id: string) => {
      if (route.hash !== `#${id}`) {
        void router.replace({ ...route, hash: `#${id}` })
      }
      scrollToSection(id)
    }

    const setupObserver = () => {
      if (observer) observer.disconnect()
      const root = scrollContainer.value
      if (!root || typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver(
        (entries) => {
          if (suppressObserver.value) return
          // Pick the entry closest to the top of the viewport that is at
          // least partially visible. `isIntersecting` alone isn't enough —
          // multiple sections can be visible at once and we want the topmost.
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          const first = visible[0]
          if (!first) return
          const id = (first.target as HTMLElement).dataset.sectionId
          if (id && id !== activeId.value) {
            activeId.value = id
            if (route.hash !== `#${id}`) {
              void router.replace({ ...route, hash: `#${id}` })
            }
          }
        },
        {
          root,
          // Only count a section as "current" once its top is comfortably
          // within the upper third of the viewport.
          rootMargin: '0px 0px -66% 0px',
          threshold: [0, 0.1, 0.5, 1],
        }
      )
      sections.value.forEach((s) => {
        const el = document.getElementById(sectionAnchorId(s.id))
        if (el) observer!.observe(el)
      })
    }

    onMounted(async () => {
      await editor.load()
      await nextTick()
      setupObserver()
      const hash = hashFromRoute()
      if (hash) {
        // Wait one more tick so child cards (which lazy-load their own data)
        // have laid out — otherwise scrollIntoView lands above the target.
        await nextTick()
        scrollToSection(hash, 'auto')
      }
    })

    // projectExists changes the available sections; re-attach the observer
    // and honour a hash that just became valid.
    watch(editor.projectExists, async () => {
      await nextTick()
      setupObserver()
      const hash = hashFromRoute()
      if (hash && hash !== activeId.value) scrollToSection(hash, 'auto')
    })

    // External hash changes (browser back/forward, links) should drive the view.
    watch(
      () => route.hash,
      (h) => {
        const id = (h ?? '').replace(/^#/, '')
        if (id && id !== activeId.value && sections.value.some((s) => s.id === id)) {
          scrollToSection(id)
        }
      }
    )

    onBeforeUnmount(() => {
      observer?.disconnect()
      observer = null
    })

    const { width: navWidth, onResize: onResizeNav } = usePanelResize(240, 180, 420)

    const sectionAttrs = (id: string) => ({
      id: sectionAnchorId(id),
      'data-section-id': id,
      'aria-label': sections.value.find((s) => s.id === id)?.label,
    })

    const settingsDraft = computed(() => editor.draft.value.settings)

    const setRestrict = (v: boolean) => {
      editor.draft.value = {
        ...editor.draft.value,
        settings: { ...editor.draft.value.settings, restrictWritesToProjectRoot: v },
      }
    }

    const setMaxEntityAttrs = (v: number) => {
      editor.draft.value = {
        ...editor.draft.value,
        settings: { ...editor.draft.value.settings, diagramMaxEntityAttributes: v },
      }
    }

    const setMaxEnumValues = (v: number) => {
      editor.draft.value = {
        ...editor.draft.value,
        settings: { ...editor.draft.value.settings, diagramMaxEnumValues: v },
      }
    }

    return () => (
      <div class="d-flex flex-column fill-height">
        <AppTitleBar>
          {{
            title: () => (
              <div class="d-flex align-center ga-2">
                <VIcon icon={SettingsIcon} />
                <span>Preferences</span>
              </div>
            ),
          }}
        </AppTitleBar>
        {editor.loading.value && <VProgressLinear indeterminate color="primary" />}

        <div
          ref={(el) => {
            scrollContainer.value = el as HTMLElement | null
          }}
          class="flex-grow-1 overflow-auto py-2"
          style="min-height: 0"
        >
          <div
            class="d-flex mx-auto px-2"
            style={{
              // Sidebar + divider + content. Centering the whole pair keeps
              // the sidebar's right edge flush against the content's left
              // edge on wide screens (where the right pane would otherwise
              // leave a gap because content has its own max-width).
              maxWidth: `${navWidth.value + 8 + CONTENT_MAX_WIDTH + 16}px`,
              minHeight: '100%',
              gap: '0',
            }}
          >
            <VCard
              class="d-flex flex-column flex-shrink-0 overflow-hidden"
              style={{
                width: `${navWidth.value}px`,
                position: 'sticky',
                top: '0',
                alignSelf: 'flex-start',
                // Cap to the scroll viewport so a tall nav (many sections
                // in a future iteration) doesn't push the sticky element
                // past the bottom of the visible area.
                maxHeight: '100%',
              }}
              elevation={2}
              rounded="lg"
            >
              <SettingsNav
                items={sections.value}
                activeId={activeId.value}
                onSelect={selectSection}
              />
            </VCard>

            <PanelDivider onResize={onResizeNav} />

            <div
              class="d-flex flex-column flex-grow-1"
              style={{ minWidth: '0', maxWidth: `${CONTENT_MAX_WIDTH}px` }}
            >
              <div class="px-4 pb-2 flex-grow-1">
                {!editor.projectExists.value && (
                  <VAlert type="info" class="mb-4" density="comfortable">
                    No project file yet. Click the project name on the home page to create{' '}
                    <code>.xomda/project.json</code>.
                  </VAlert>
                )}

                <section {...sectionAttrs('sandbox')}>
                  <VCard elevation={1} rounded="lg" class="mb-4">
                    <VCardTitle>File-system sandbox</VCardTitle>
                    <VDivider />
                    <VCardText>
                      <VSwitch
                        modelValue={settingsDraft.value.restrictWritesToProjectRoot}
                        onUpdate:modelValue={(v: boolean | null) => setRestrict(v ?? false)}
                        label="Restrict writes to the project root"
                        hint="When on, generation will refuse to write files outside the project root."
                        persistentHint
                        color="primary"
                        density="comfortable"
                      />
                    </VCardText>
                  </VCard>
                </section>

                <section {...sectionAttrs('diagram')}>
                  <VCard elevation={1} rounded="lg" class="mb-4">
                    <VCardTitle>Diagram</VCardTitle>
                    <VDivider />
                    <VCardText class="d-flex flex-column ga-4">
                      <VNumberInput
                        modelValue={settingsDraft.value.diagramMaxEntityAttributes}
                        onUpdate:modelValue={(v: number | null) => {
                          if (typeof v === 'number' && Number.isFinite(v)) {
                            setMaxEntityAttrs(Math.max(1, Math.min(200, Math.floor(v))))
                          }
                        }}
                        label="Max entity attributes before scrolling"
                        hint="Rows shown inside an entity before the list scrolls. Default 10."
                        persistentHint
                        min={1}
                        max={200}
                        step={1}
                        density="comfortable"
                        variant="outlined"
                      />
                      <VNumberInput
                        modelValue={settingsDraft.value.diagramMaxEnumValues}
                        onUpdate:modelValue={(v: number | null) => {
                          if (typeof v === 'number' && Number.isFinite(v)) {
                            setMaxEnumValues(Math.max(1, Math.min(200, Math.floor(v))))
                          }
                        }}
                        label="Max enum values before scrolling"
                        hint="Rows shown inside an enum before the list scrolls. Default 10."
                        persistentHint
                        min={1}
                        max={200}
                        step={1}
                        density="comfortable"
                        variant="outlined"
                      />
                      <VDivider class="my-2" />
                      <VSwitch
                        modelValue={prefs.diagramDimNonSelected}
                        onUpdate:modelValue={(v: boolean | null) =>
                          (prefs.diagramDimNonSelected = v ?? false)
                        }
                        label="Dim non-selected items"
                        hint="When something is selected, fade everything else on the canvas to draw the eye."
                        persistentHint
                        color="primary"
                        density="comfortable"
                      />
                      <div>
                        <div class="text-caption text-medium-emphasis mb-1">
                          Dim amount: {Math.round(prefs.diagramDimAmount * 100)}%
                        </div>
                        <VSlider
                          modelValue={prefs.diagramDimAmount}
                          onUpdate:modelValue={(v: number) => (prefs.diagramDimAmount = v)}
                          min={0}
                          max={1}
                          step={0.05}
                          disabled={!prefs.diagramDimNonSelected}
                          density="comfortable"
                          color="primary"
                          hideDetails
                          aria-label="Dim amount"
                        />
                      </div>
                      <VDivider class="my-2" />
                      <div>
                        <div class="text-caption text-medium-emphasis mb-1">
                          Pan inertia:{' '}
                          {prefs.diagramInertia === 0
                            ? 'off'
                            : `${Math.round(prefs.diagramInertia * 100)}%`}
                        </div>
                        <VSlider
                          modelValue={prefs.diagramInertia}
                          onUpdate:modelValue={(v: number) => (prefs.diagramInertia = v)}
                          min={0}
                          max={0.99}
                          step={0.01}
                          density="comfortable"
                          color="primary"
                          hideDetails
                          aria-label="Pan inertia"
                        />
                        <div class="text-caption text-disabled mt-1">
                          How far the canvas keeps gliding after you release a drag. Slide to 0 to
                          stop instantly.
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </section>

                {editor.projectExists.value && (
                  <section {...sectionAttrs('boundaries')}>
                    <ProjectBoundariesCard />
                  </section>
                )}
                {editor.projectExists.value && (
                  <section {...sectionAttrs('plugins')}>
                    <PluginsCard />
                  </section>
                )}
              </div>
              <PreferencesActionsBar />
            </div>
          </div>
        </div>
      </div>
    )
  },
})
