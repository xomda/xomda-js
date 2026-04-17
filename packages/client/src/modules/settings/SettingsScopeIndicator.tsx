import {
  DeployedCodeOutlineIcon,
  DesktopMacOutlineIcon,
  DesktopWindowsOutlineIcon,
} from '@xomda/icons'
import type { PropType } from 'vue'
import { computed, defineComponent } from 'vue'
import { VIcon, VTooltip } from 'vuetify/components'

export type SettingsScope = 'project' | 'local'

// Mirrors the same UA sniff in AppSearch — keeping the local-scope icon
// in sync with the platform the user is on (Mac tower vs Windows tower
// silhouette). Anything non-Apple falls back to the Windows glyph; we'd
// rather show *a* desktop than misfire on Linux/Chrome OS edge cases.
const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Tiny header-corner badge that tells the user where a settings card
 * persists:
 *   - 'project' → `.xomda/project.json`, travels with the repo
 *     (DeployedCodeOutlineIcon).
 *   - 'local'   → browser localStorage, this machine only — shown as a
 *     desktop tower that matches the host OS.
 *
 * Stays minimal so it never competes with the title. Tooltip carries
 * the long-form explanation; the icon itself uses an `aria-label` so
 * screen readers get the same hint without hovering.
 */
export const SettingsScopeIndicator = defineComponent({
  name: 'SettingsScopeIndicator',
  props: {
    scope: { type: String as PropType<SettingsScope>, required: true },
  },
  setup(props) {
    const cfg = computed(() =>
      props.scope === 'project'
        ? {
            icon: DeployedCodeOutlineIcon,
            label: 'Project setting',
            tooltip:
              'Project setting — saved in .xomda/project.json and shared with everyone using this project.',
          }
        : {
            icon: isMacPlatform() ? DesktopMacOutlineIcon : DesktopWindowsOutlineIcon,
            label: 'Local setting',
            tooltip: 'Local setting — saved in this browser only, on this machine.',
          }
    )

    return () => (
      <VTooltip text={cfg.value.tooltip} location="top">
        {{
          activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
            <span
              {...tipProps}
              aria-label={cfg.value.label}
              class="d-inline-flex align-center text-medium-emphasis"
              data-testid={`settings-scope-${props.scope}`}
            >
              <VIcon icon={cfg.value.icon} size={18} />
            </span>
          ),
        }}
      </VTooltip>
    )
  },
})
