import { defaultProjectSettings } from '@xomda/core'
import { useAsyncState } from '@xomda/ui'
import { computed, defineComponent, onMounted, ref } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VChip, VDivider, VSwitch } from 'vuetify/components'

import { trpc } from '../../trpc'
import styles from './ProjectBoundariesCard.module.scss'

/**
 * Settings card for the two "where does the project end?" knobs:
 *
 *   - isRoot: declares this project a workspace boundary. The
 *     subproject scan stops at it (when traversing from above) and
 *     the homepage's "parent project found" suggestion is silenced
 *     when set on the current project.
 *
 *   - excludeFromScan: folder names skipped during nested-project
 *     discovery. Stored sorted; UI presents them as removable chips
 *     plus an add-by-typing input.
 */
export const ProjectBoundariesCard = defineComponent({
  name: 'ProjectBoundariesCard',
  setup() {
    const isRoot = ref(false)
    const excludes = ref<string[]>([])
    const initial = ref<{ isRoot: boolean; excludes: string[] }>({
      isRoot: false,
      excludes: [],
    })
    const newExclude = ref('')
    const saved = ref(false)
    const { loading, run } = useAsyncState<void>()

    const load = async () => {
      const meta = await trpc.project.meta.query()
      const settings = meta?.settings ?? defaultProjectSettings()
      isRoot.value = settings.isRoot
      excludes.value = [...settings.excludeFromScan]
      initial.value = { isRoot: settings.isRoot, excludes: [...settings.excludeFromScan] }
    }

    onMounted(() => {
      void load()
    })

    const isDirty = computed(
      () =>
        isRoot.value !== initial.value.isRoot ||
        excludes.value.length !== initial.value.excludes.length ||
        excludes.value.some((e, i) => e !== initial.value.excludes[i])
    )

    const removeExclude = (name: string) => {
      excludes.value = excludes.value.filter((e) => e !== name)
      saved.value = false
    }

    const addExclude = () => {
      const v = newExclude.value.trim()
      if (!v || excludes.value.includes(v)) {
        newExclude.value = ''
        return
      }
      excludes.value = [...excludes.value, v].sort()
      newExclude.value = ''
      saved.value = false
    }

    const save = () =>
      run(async () => {
        const existing = await trpc.project.meta.query()
        await trpc.project.updateMeta.mutate({
          meta: {
            name: existing?.name ?? 'project',
            description:
              existing && typeof existing.description === 'string'
                ? existing.description
                : undefined,
            versions: existing?.versions ?? { head: null, versions: [] },
            settings: {
              ...(existing?.settings ?? defaultProjectSettings()),
              isRoot: isRoot.value,
              excludeFromScan: [...excludes.value],
            },
            plugins: existing?.plugins ?? [],
          },
        })
        initial.value = { isRoot: isRoot.value, excludes: [...excludes.value] }
        saved.value = true
        setTimeout(() => (saved.value = false), 2500)
      })

    return () => (
      <VCard elevation={1} rounded="lg" class="mb-4">
        <VCardTitle>Project boundaries</VCardTitle>
        <VDivider />
        <VCardText class="d-flex flex-column ga-3">
          <VSwitch
            modelValue={isRoot.value}
            onUpdate:modelValue={(v: boolean | null) => {
              isRoot.value = v ?? false
              saved.value = false
            }}
            label="This is the root project"
            hint="When on, xomda won't suggest using a parent .xomda; nested projects above won't traverse into this one."
            persistentHint
            color="primary"
            density="comfortable"
          />

          <div>
            <div class="text-caption text-disabled mb-2">
              Excluded folders (nested-project scan skips these)
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
                placeholder="Folder name (e.g. vendor) or relative path"
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

          <div class="d-flex align-center ga-3">
            <VBtn
              color="primary"
              onClick={save}
              disabled={!isDirty.value || loading.value}
              loading={loading.value}
            >
              Save
            </VBtn>
            {saved.value && (
              <span class="text-success" style="font-size:0.875rem">
                Saved.
              </span>
            )}
          </div>
        </VCardText>
      </VCard>
    )
  },
})
