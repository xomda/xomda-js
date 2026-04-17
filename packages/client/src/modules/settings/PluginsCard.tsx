import { getIconForPlugin } from '@xomda/analysis-client'
import { LoopIcon } from '@xomda/icons'
import { PluginIcon } from '@xomda/ui'
import { computed, defineComponent } from 'vue'
import {
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VDivider,
  VListItem,
  VProgressCircular,
  VSwitch,
  VTooltip,
} from 'vuetify/components'

import styles from './PluginsCard.module.scss'
import { usePreferencesContext } from './usePreferencesEditor'

/**
 * Card UI listing every analysis plugin known to the server. Each row
 * is a switch backed by the shared preferences editor; the parent
 * SettingsView's sticky Save bar commits any toggles to disk.
 *
 * The "Auto-detect" action is intentionally outside that buffered flow:
 * it rescans and persists immediately, then rebaselines the plugins
 * column so unrelated dirty fields stay dirty.
 *
 * Surfaces three states per plugin:
 *   - enabled (in the draft plugins list, or the list is empty)
 *   - detected (matched on last scan)
 *   - neither (registered but disabled and not currently relevant)
 */
export const PluginsCard = defineComponent({
  name: 'PluginsCard',
  setup() {
    const editor = usePreferencesContext()

    const sortedPlugins = computed(() =>
      [...editor.allPlugins.value].sort((a, b) => a.name.localeCompare(b.name))
    )

    // Server treats an empty `plugins` array as "no filter — every detected
    // plugin contributes". Mirror that in the UI by treating every plugin as
    // enabled when the draft list is empty.
    const enabledSet = computed(() => new Set(editor.draft.value.plugins))
    const noFilter = computed(() => editor.draft.value.plugins.length === 0)

    const toggle = (id: string, on: boolean) => {
      // Materialise "no filter = all on" into an explicit list the first
      // time the user toggles anything off, so subsequent toggles diff
      // against a stable baseline.
      const base = noFilter.value ? editor.allPlugins.value.map((p) => p.id) : enabledSet.value
      const next = new Set(base)
      if (on) next.add(id)
      else next.delete(id)
      editor.draft.value = {
        ...editor.draft.value,
        plugins: [...next].sort(),
      }
    }

    return () => (
      <VCard elevation={1} rounded="lg" class="mb-4">
        <div class="d-flex align-center pr-4">
          <VCardTitle class="flex-grow-1">Analysis plugins</VCardTitle>
          <VBtn
            size="small"
            variant="tonal"
            color="primary"
            prependIcon={LoopIcon}
            loading={editor.refreshing.value}
            disabled={editor.refreshing.value}
            onClick={() => void editor.refreshPluginsAutoDetect()}
          >
            Auto-detect
          </VBtn>
        </div>
        <VDivider />
        <VCardText>
          {editor.allPlugins.value.length === 0 ? (
            <div class="pa-4 text-center text-disabled">
              <VProgressCircular indeterminate size={20} />
            </div>
          ) : (
            <div>
              {sortedPlugins.value.map((p) => {
                const icon = getIconForPlugin(p.id)
                // Core plugins are always on regardless of the project's
                // plugin filter; the switch is rendered disabled and forced
                // to true so the user can see the plugin exists without
                // being able to break the platform by turning it off.
                const isEnabled = p.core || noFilter.value || enabledSet.value.has(p.id)
                const isDetected = editor.detectedPlugins.value.has(p.id)
                const caption = p.core
                  ? 'Core plugin — always on'
                  : isDetected
                    ? 'Detected in this project'
                    : 'Not detected'
                const renderSwitch = () => (
                  <VSwitch
                    class={['mr-2']}
                    modelValue={isEnabled}
                    onUpdate:modelValue={(v: boolean | null) =>
                      p.core ? undefined : toggle(p.id, !!v)
                    }
                    disabled={p.core || editor.refreshing.value}
                    color="primary"
                    density="comfortable"
                    hideDetails
                  />
                )
                return (
                  <VListItem key={p.id} class={styles.row}>
                    {{
                      prepend: () =>
                        icon ? (
                          <span class="mr-3">
                            <PluginIcon icon={icon} size={18} label={p.name} />
                          </span>
                        ) : (
                          <span class="mr-3" style={{ width: '18px', display: 'inline-block' }} />
                        ),
                      default: () => (
                        <div class="d-flex align-center">
                          <div class="flex-grow-1">
                            <div>{p.name}</div>
                            <div class="text-caption text-disabled">{caption}</div>
                          </div>
                          {p.core ? (
                            <VTooltip text="Core plugin — always on" location="top">
                              {{
                                activator: ({
                                  props: tipProps,
                                }: {
                                  props: Record<string, unknown>
                                }) => <div {...tipProps}>{renderSwitch()}</div>,
                              }}
                            </VTooltip>
                          ) : (
                            renderSwitch()
                          )}
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
