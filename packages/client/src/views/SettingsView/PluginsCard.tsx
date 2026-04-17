import { getIconForPlugin } from '@xomda/analysis-client'
import { defaultProjectSettings } from '@xomda/core'
import { LoopIcon } from '@xomda/icons'
import { useAsyncState } from '@xomda/ui'
import { computed, defineComponent, onMounted, type PropType, ref } from 'vue'
import {
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VDivider,
  VIcon,
  VListItem,
  VProgressCircular,
  VSwitch,
} from 'vuetify/components'

import { trpc } from '../../trpc'

interface PluginInfo {
  id: string
  name: string
}

/**
 * Compact card that lists every analysis plugin known to the server,
 * lets the user toggle each on/off (stored in project.plugins, sorted),
 * and offers a "Refresh detection" button to ask the server to re-scan
 * and replace the list with everything that matches.
 *
 * Surfaces three states per plugin:
 *   - enabled (in project.plugins)
 *   - detected (matched on last scan)
 *   - neither (registered but disabled and not currently relevant)
 */
export const PluginsCard = defineComponent({
  name: 'PluginsCard',
  props: {
    /** Called whenever the active list changes, so the parent can refresh. */
    onChange: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const allPlugins = ref<PluginInfo[]>([])
    const enabled = ref<Set<string>>(new Set())
    const detected = ref<Set<string>>(new Set())
    const { loading: refreshing, run: doRefresh } = useAsyncState<void>()
    const { loading: saving, run: doSave } = useAsyncState<void>()

    const sortedPlugins = computed(() =>
      [...allPlugins.value].sort((a, b) => a.name.localeCompare(b.name))
    )

    const load = async () => {
      const [list, meta] = await Promise.all([
        trpc.project.listPlugins.query(),
        trpc.project.meta.query(),
      ])
      allPlugins.value = list
      enabled.value = new Set(meta?.plugins ?? [])
      // Re-using the scan endpoint's detectedIds keeps a single source
      // of truth for what's currently relevant.
      try {
        const scan = await trpc.project.scan.query()
        detected.value = new Set(scan.detectedIds)
      } catch {
        detected.value = new Set()
      }
    }

    onMounted(() => {
      void load()
    })

    const refresh = () =>
      doRefresh(async () => {
        const result = await trpc.project.refreshPlugins.mutate({})
        enabled.value = new Set(result.plugins)
        detected.value = new Set(result.detectedIds)
        props.onChange?.()
      })

    const toggle = (id: string, on: boolean) =>
      doSave(async () => {
        const next = new Set(enabled.value)
        if (on) next.add(id)
        else next.delete(id)
        const meta = await trpc.project.meta.query()
        await trpc.project.updateMeta.mutate({
          meta: {
            name: meta?.name ?? 'project',
            description:
              meta && typeof meta.description === 'string' ? meta.description : undefined,
            versions: meta?.versions ?? { head: null, versions: [] },
            settings: meta?.settings ?? defaultProjectSettings(),
            plugins: [...next],
          },
        })
        enabled.value = next
        props.onChange?.()
      })

    return () => (
      <VCard elevation={1} rounded="lg" class="mb-4">
        <div class="d-flex align-center pr-4">
          <VCardTitle class="flex-grow-1">Analysis plugins</VCardTitle>
          <VBtn
            size="small"
            variant="tonal"
            color="primary"
            prependIcon={LoopIcon}
            loading={refreshing.value}
            disabled={refreshing.value}
            onClick={refresh}
          >
            Refresh detection
          </VBtn>
        </div>
        <VDivider />
        <VCardText>
          {allPlugins.value.length === 0 ? (
            <div class="pa-4 text-center text-disabled">
              <VProgressCircular indeterminate size={20} />
            </div>
          ) : (
            <div>
              {sortedPlugins.value.map((p) => {
                const icon = getIconForPlugin(p.id)
                const isEnabled = enabled.value.has(p.id)
                const isDetected = detected.value.has(p.id)
                return (
                  <VListItem key={p.id}>
                    {{
                      prepend: () =>
                        icon ? (
                          <VIcon icon={icon} size={18} class="mr-3" />
                        ) : (
                          <span class="mr-3" style={{ width: '18px', display: 'inline-block' }} />
                        ),
                      default: () => (
                        <div class="d-flex align-center">
                          <div class="flex-grow-1">
                            <div>{p.name}</div>
                            <div class="text-caption text-disabled">
                              {isDetected ? 'Detected in this project' : 'Not detected'}
                            </div>
                          </div>
                          <VSwitch
                            class={['mr-2']}
                            modelValue={isEnabled}
                            onUpdate:modelValue={(v: boolean | null) => toggle(p.id, !!v)}
                            disabled={saving.value || refreshing.value}
                            color="primary"
                            density="comfortable"
                            hideDetails
                          />
                        </div>
                      ),
                    }}
                  </VListItem>
                )
              })}
            </div>
          )}
        </VCardText>
      </VCard>
    )
  },
})
