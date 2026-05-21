import { AddIcon, ArrowUpwardIcon, FolderXomdaIcon, ModelIcon, RefreshIcon } from '@xomda/icons'
import {
  MenuButton,
  type MenuItemConfig,
  useNotificationsStore,
  usePrompt,
  Version,
} from '@xomda/ui'
import { computed, defineComponent, type PropType, ref } from 'vue'
import { VBtn, VChip, VIcon, VSkeletonLoader, VTooltip } from 'vuetify/components'

import { useWorkspaceStore, type WorkspaceProject } from '../../stores/workspace'
import styles from './WorkspaceSelector.module.scss'

export type WorkspaceSelectorPrefix = 'Model' | 'Templates'

/**
 * Title-bar dropdown that picks the active project + model. Reads/writes
 * `useWorkspaceStore` and renders via the labelled `MenuButton`.
 *
 * Used in both ModelView and TemplatesView — the surfaces share the same
 * lens (which project, which model) so they share the same affordance.
 * The `labelPrefix` prop only changes the leading caption ("Model: …" vs
 * "Templates: …"); the menu structure is identical.
 *
 * Before any switch (project or model), if `confirmSwitch` is provided
 * it's awaited; returning `false` aborts the switch so the caller can
 * surface its unsaved-changes prompt and bail out cleanly.
 */
export const WorkspaceSelector = defineComponent({
  name: 'WorkspaceSelector',
  props: {
    labelPrefix: {
      type: String as PropType<WorkspaceSelectorPrefix>,
      default: 'Model',
    },
    /**
     * Hide the "New model" action — useful for surfaces where model
     * creation isn't appropriate (e.g. read-only preview shells).
     */
    showCreateModel: { type: Boolean, default: true },
    /**
     * Optional guard run before any project/model switch. Return `true`
     * to allow the switch, `false` to cancel it. Typically wraps
     * `useUnsavedChangesPrompt().promptUnsavedChanges()` in the caller.
     */
    confirmSwitch: {
      type: Function as PropType<() => Promise<boolean> | boolean>,
      default: undefined,
    },
  },
  setup(props) {
    const store = useWorkspaceStore()
    const { prompt } = usePrompt()
    const notify = useNotificationsStore()

    // Local guard so the menu's `closeOnContentClick` doesn't kill an
    // in-flight prompt — we close the menu only after the async resolves.
    const switching = ref(false)

    async function withGuard(fn: () => Promise<void> | void): Promise<void> {
      if (switching.value) return
      switching.value = true
      try {
        if (props.confirmSwitch) {
          const ok = await props.confirmSwitch()
          if (!ok) return
        }
        await fn()
      } finally {
        switching.value = false
      }
    }

    function onSelectModel(modelId: string): void {
      if (modelId === store.activeModelId) return
      void withGuard(() => store.selectModel(modelId))
    }

    function onSelectProject(root: string, modelId?: string): void {
      if (root === store.activeProjectRoot && (modelId == null || modelId === store.activeModelId))
        return
      void withGuard(() => {
        store.selectProject(root)
        if (modelId) store.selectModel(modelId)
      })
    }

    async function onCreateModel(root: string, projectName: string): Promise<void> {
      const name = await prompt({
        title: `New model in ${projectName}`,
        label: 'Name',
        placeholder: 'My model',
        confirmLabel: 'Create',
        validate: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      })
      if (!name) return
      const created = await store.createModel(root, name.trim())
      if (created) {
        notify.success(`Model "${created.name}" created`)
      }
    }

    const label = computed(() => {
      const proj = store.activeProject
      const model = store.activeModel
      if (!proj) return `${props.labelPrefix}: …`
      if (!model) return `${props.labelPrefix}: ${proj.name} · (no model)`
      return `${props.labelPrefix}: ${model.name}`
    })

    /** Build the menu for a single project (active or in submenu). */
    function projectSection(project: WorkspaceProject): MenuItemConfig[] {
      const items: MenuItemConfig[] = [{ key: `sh-${project.root}`, subheader: project.name }]
      if (project.models.length === 0) {
        items.push({ key: `empty-${project.root}`, title: '(no models yet)', disabled: true })
      } else {
        for (const m of project.models) {
          items.push({
            key: `m-${project.root}-${m.id}`,
            title: m.name,
            subtitle: m.isPrimary ? `primary · v${m.version}` : `v${m.version}`,
            icon: ModelIcon,
            checked: m.id === store.activeModelId && project.root === store.activeProjectRoot,
            onClick: () =>
              project.root === store.activeProjectRoot
                ? onSelectModel(m.id)
                : onSelectProject(project.root, m.id),
          })
        }
      }
      if (props.showCreateModel) {
        items.push({ divider: true, key: `d-${project.root}` })
        items.push({
          key: `new-${project.root}`,
          title: `New model in ${project.name}`,
          icon: AddIcon,
          onClick: () => void onCreateModel(project.root, project.name),
        })
      }
      return items
    }

    const items = computed<MenuItemConfig[]>(() => {
      const active = store.activeProject
      const others = store.projects.filter((p) => p.root !== store.activeProjectRoot)
      if (!active) {
        return [{ key: 'empty', title: 'No project loaded', disabled: true }]
      }
      const out: MenuItemConfig[] = projectSection(active)
      if (others.length > 0) {
        out.push({ divider: true, key: 'd-others' })
        out.push({ key: 'sh-others', subheader: 'Other projects' })
        for (const p of others) {
          // `· ROOT` suffix marks an independent workspace boundary the same
          // way HomeView does. Keeps the affordance visible without bolting a
          // VChip into the menu primitive (text-only signal is colour-safe).
          const title = p.isRoot ? `${p.name} · ROOT` : p.name
          out.push({
            key: `sub-${p.root}`,
            title,
            icon: FolderXomdaIcon,
            submenu: projectSection(p),
          })
        }
      }
      return out
    })

    function renderRetry() {
      return (
        <div class={['d-flex align-center ga-2', styles.errorCluster]}>
          <span class="text-error">Workspace failed to load</span>
          <VTooltip text="Retry" location="bottom">
            {{
              activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                <VBtn
                  {...tipProps}
                  icon={RefreshIcon}
                  size="small"
                  variant="text"
                  density="comfortable"
                  aria-label="Retry loading workspace"
                  onClick={() => void store.load()}
                />
              ),
            }}
          </VTooltip>
        </div>
      )
    }

    return () => {
      if (store.loading && !store.workspace) {
        return (
          <VSkeletonLoader
            type="chip"
            class={styles.skeleton}
            aria-label="Loading workspace"
            aria-busy="true"
          />
        )
      }
      if (store.error && !store.workspace) {
        return renderRetry()
      }

      const proj = store.activeProject
      const model = store.activeModel
      const isRoot = proj?.isRoot ?? false
      const showRootChip =
        isRoot && (store.subprojects.length > 0 || proj?.root !== store.workspace?.root)

      return (
        <div class={['d-inline-flex align-center ga-2', styles.selector]}>
          <MenuButton
            label={label.value}
            items={items.value}
            tooltip="Switch project or model"
            ariaLabel={`${props.labelPrefix} selector — current ${label.value}`}
            variant="text"
            size="small"
            location="bottom"
          />
          {model?.version ? (
            <Version version={model.version} prefix="v" chip size="x-small" />
          ) : null}
          {showRootChip ? (
            <VTooltip text="Independent root workspace — generation isolated from the parent.">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VChip
                    {...tipProps}
                    size="x-small"
                    color="primary"
                    variant="outlined"
                    class={styles.rootChip}
                  >
                    <VIcon icon={ArrowUpwardIcon} size={10} class="me-1" />
                    ROOT
                  </VChip>
                ),
              }}
            </VTooltip>
          ) : null}
        </div>
      )
    }
  },
})
