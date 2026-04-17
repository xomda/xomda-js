import { computed, defineComponent, ref } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VChip, VDivider, VSwitch } from 'vuetify/components'

import styles from './ProjectBoundariesCard.module.scss'
import { usePreferencesContext } from './usePreferencesEditor'

/**
 * Card UI for the two "where does the project end?" knobs:
 *
 *   - isRoot: declares this project a workspace boundary. The
 *     subproject scan stops at it (when traversing from above) and
 *     the homepage's "parent project found" suggestion is silenced
 *     when set on the current project.
 *
 *   - excludeFromScan: folder names skipped during nested-project
 *     discovery. Stored sorted; UI presents them as removable chips
 *     plus an add-by-typing input.
 *
 * State lives on the shared preferences editor (`usePreferencesContext`)
 * so the sticky Save / Cancel bar in `SettingsView` drives this card and
 * the others together.
 */
export const ProjectBoundariesCard = defineComponent({
  name: 'ProjectBoundariesCard',
  setup() {
    const editor = usePreferencesContext()
    const newExclude = ref('')

    const isRoot = computed({
      get: () => editor.draft.value.settings.isRoot,
      set: (v) => {
        editor.draft.value = {
          ...editor.draft.value,
          settings: { ...editor.draft.value.settings, isRoot: v },
        }
      },
    })

    const excludes = computed(() => editor.draft.value.settings.excludeFromScan)

    const setExcludes = (next: string[]) => {
      editor.draft.value = {
        ...editor.draft.value,
        settings: { ...editor.draft.value.settings, excludeFromScan: next },
      }
    }

    const removeExclude = (name: string) => {
      setExcludes(excludes.value.filter((e) => e !== name))
    }

    const addExclude = () => {
      const v = newExclude.value.trim()
      if (!v || excludes.value.includes(v)) {
        newExclude.value = ''
        return
      }
      setExcludes([...excludes.value, v].sort())
      newExclude.value = ''
    }

    return () => (
      <VCard elevation={1} rounded="lg" class="mb-4">
        <VCardTitle>Project boundaries</VCardTitle>
        <VDivider />
        <VCardText class="d-flex flex-column ga-3">
          <VSwitch
            modelValue={isRoot.value}
            onUpdate:modelValue={(v: boolean | null) => (isRoot.value = v ?? false)}
            label="This is the root project"
            hint="When on, xomda won't suggest using a parent .xomda; nested projects above won't traverse into this one."
            persistentHint
            color="primary"
            density="comfortable"
          />

          <div>
            <div class="text-caption text-disabled mb-1">
              Excluded paths (project scan skips these)
            </div>
            <div class="text-caption text-disabled mb-2">
              Folder name (e.g. <code>vendor</code>), project-relative path (e.g.{' '}
              <code>packages/legacy</code>), or glob (e.g. <code>packages/*/dist</code>,{' '}
              <code>**/tmp</code>).
            </div>
            <div class={styles.chipRow}>
              {excludes.value.map((name) => (
                <VChip
                  key={name}
                  size="small"
                  label
                  closable
                  onClick:close={() => removeExclude(name)}
                >
                  {name}
                </VChip>
              ))}
              {excludes.value.length === 0 && (
                <span class="text-caption text-disabled">
                  No exclusions — every folder is scanned.
                </span>
              )}
            </div>
            <div class={[styles.addRow, 'mt-2']}>
              <input
                type="text"
                value={newExclude.value}
                onInput={(e) => (newExclude.value = (e.target as HTMLInputElement).value)}
                onKeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addExclude()
                  }
                }}
                placeholder="Folder name, path, or glob pattern"
                class={styles.input}
              />
              <VBtn
                size="small"
                variant="tonal"
                onClick={addExclude}
                disabled={newExclude.value.trim().length === 0}
              >
                Add
              </VBtn>
            </div>
          </div>
        </VCardText>
      </VCard>
    )
  },
})
