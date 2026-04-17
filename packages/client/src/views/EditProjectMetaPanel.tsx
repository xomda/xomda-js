import { defaultProjectSettings } from '@xomda/core'
import { EditIcon } from '@xomda/icons'
import { SidePanel, useAsyncState } from '@xomda/ui'
import { defineComponent, type PropType, ref, watch } from 'vue'
import { VBtn } from 'vuetify/components'

import { trpc } from '../trpc'
import styles from './EditProjectMetaPanel.module.scss'

export interface ProjectMetaInitial {
  name: string
  description?: string
}

/**
 * Floating side-panel for editing the project name + description from the
 * homepage hero. Save persists to .xomda/project.json (creating it if it
 * doesn't exist) via project.updateMeta and emits `saved` so the parent
 * can refresh; Cancel emits `cancel` without writing.
 *
 * Renders fixed in the top-right of the viewport so it doesn't disturb
 * the hero layout while the user is editing.
 */
export const EditProjectMetaPanel = defineComponent({
  name: 'EditProjectMetaPanel',
  props: {
    initial: { type: Object as PropType<ProjectMetaInitial>, default: () => ({ name: '' }) },
    onSaved: { type: Function as PropType<(meta: ProjectMetaInitial) => void>, default: undefined },
    onCancel: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const name = ref(props.initial.name)
    const description = ref(props.initial.description ?? '')
    const { loading, error, run } = useAsyncState<void>()
    const nameInput = ref<HTMLInputElement | null>(null)

    // Re-sync when the parent swaps in a different initial payload.
    watch(
      () => props.initial,
      (next) => {
        name.value = next.name
        description.value = next.description ?? ''
      }
    )

    const save = async () => {
      const trimmed = name.value.trim()
      if (!trimmed) return
      await run(async () => {
        const existing = await trpc.project.meta.query()
        await trpc.project.updateMeta.mutate({
          meta: {
            name: trimmed,
            description: description.value.trim() || undefined,
            versions: existing?.versions ?? { head: null, versions: [] },
            settings: existing?.settings ?? defaultProjectSettings(),
            plugins: existing?.plugins ?? [],
          },
        })
      })
      if (!error.value) {
        props.onSaved?.({ name: trimmed, description: description.value.trim() || undefined })
      }
    }

    const cancel = () => props.onCancel?.()

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void save()
      }
    }

    return () => (
      <div class={styles.overlay} role="dialog" aria-label="Edit project" onKeydown={onKeydown}>
        <SidePanel
          title="Edit project"
          icon={EditIcon}
          width={360}
          onClose={cancel}
          closeTooltip="Cancel"
        >
          {{
            default: () => (
              <div class="d-flex flex-column ga-3">
                <div>
                  <label class="text-caption text-disabled d-block mb-1" for="hero-name">
                    Project name
                  </label>
                  <input
                    id="hero-name"
                    ref={nameInput}
                    type="text"
                    value={name.value}
                    onInput={(e) => (name.value = (e.target as HTMLInputElement).value)}
                    class={styles.input}
                  />
                </div>
                <div>
                  <label class="text-caption text-disabled d-block mb-1" for="hero-description">
                    Description (optional)
                  </label>
                  <textarea
                    id="hero-description"
                    rows={3}
                    value={description.value}
                    onInput={(e) => (description.value = (e.target as HTMLTextAreaElement).value)}
                    class={[styles.input, styles.textarea]}
                  />
                </div>
                {error.value && (
                  <div class="text-error text-caption" role="alert">
                    {error.value}
                  </div>
                )}
                <div class="text-caption text-disabled">⌘/Ctrl + Enter to save · Esc to cancel</div>
              </div>
            ),
            footer: () => (
              <div class="d-flex justify-end ga-2">
                <VBtn variant="text" onClick={cancel} disabled={loading.value}>
                  Cancel
                </VBtn>
                <VBtn
                  color="primary"
                  onClick={save}
                  disabled={loading.value || name.value.trim().length === 0}
                  loading={loading.value}
                >
                  Save
                </VBtn>
              </div>
            ),
          }}
        </SidePanel>
      </div>
    )
  },
})
