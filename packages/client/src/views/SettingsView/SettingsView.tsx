import { defaultProjectSettings } from '@xomda/core'
import { SettingsIcon } from '@xomda/icons'
import { useAsyncState } from '@xomda/ui'
import { defineComponent, onMounted, ref } from 'vue'
import {
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VContainer,
  VDivider,
  VIcon,
  VProgressLinear,
  VSwitch,
} from 'vuetify/components'

import { AppTitleBar } from '../../components'
import { trpc } from '../../trpc'
import { PluginsCard } from './PluginsCard'
import { ProjectBoundariesCard } from './ProjectBoundariesCard'

/**
 * Settings page — owns project-level toggles that don't belong on the
 * homepage. Project name and description are *not* edited here; they
 * live on the homepage hero (click the title) so they feel like the
 * project's identity rather than a setting buried in a form.
 */
export const SettingsView = defineComponent({
  name: 'SettingsView',
  setup() {
    const restrict = ref(true)
    const initialRestrict = ref(true)
    const projectExists = ref(false)
    const saved = ref(false)
    const { loading, run } = useAsyncState<void>()

    const load = async () => {
      const meta = await trpc.project.meta.query()
      if (meta) {
        projectExists.value = true
        restrict.value = meta.settings.restrictWritesToProjectRoot
        initialRestrict.value = meta.settings.restrictWritesToProjectRoot
      } else {
        projectExists.value = false
      }
    }

    onMounted(() => {
      void load()
    })

    const isDirty = () => restrict.value !== initialRestrict.value

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
              // Preserve isRoot, excludeFromScan, and any future settings.
              ...(existing?.settings ?? defaultProjectSettings()),
              restrictWritesToProjectRoot: restrict.value,
            },
            plugins: existing?.plugins ?? [],
          },
        })
        initialRestrict.value = restrict.value
        projectExists.value = true
        saved.value = true
        setTimeout(() => (saved.value = false), 2500)
      })

    return () => (
      <div class="d-flex flex-column fill-height">
        <AppTitleBar>
          {{
            title: () => (
              <div class="d-flex align-center ga-2">
                <VIcon icon={SettingsIcon} />
                <span>Settings</span>
              </div>
            ),
          }}
        </AppTitleBar>
        {loading.value && <VProgressLinear indeterminate color="primary" />}
        <VContainer class="overflow-auto" style={{ maxWidth: '720px' }}>
          {!projectExists.value && (
            <VAlert type="info" class="mb-4" density="comfortable">
              No project file yet. Click the project name on the home page to create{' '}
              <code>.xomda/project.json</code>.
            </VAlert>
          )}

          <VCard elevation={1} rounded="lg" class="mb-4">
            <VCardTitle>File-system sandbox</VCardTitle>
            <VDivider />
            <VCardText>
              <VSwitch
                modelValue={restrict.value}
                onUpdate:modelValue={(v: boolean | null) => {
                  restrict.value = v ?? false
                  saved.value = false
                }}
                label="Restrict writes to the project root"
                hint="When on, generation will refuse to write files outside the project root."
                persistentHint
                color="primary"
                density="comfortable"
              />
            </VCardText>
          </VCard>

          <div class="d-flex align-center ga-3 mb-4">
            <VBtn color="primary" onClick={save} disabled={!isDirty() || loading.value}>
              Save
            </VBtn>
            {saved.value && (
              <span class="text-success" style="font-size:0.875rem">
                Saved.
              </span>
            )}
          </div>

          {projectExists.value && <ProjectBoundariesCard />}
          {projectExists.value && <PluginsCard />}
        </VContainer>
      </div>
    )
  },
})
