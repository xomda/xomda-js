import { computed, type ComputedRef } from 'vue'
import { useTheme } from 'vuetify'

export type ThemeModeProp = 'light' | 'dark' | 'auto'

/**
 * Resolve a `mode` prop ('light' | 'dark' | 'auto') to a reactive `isDark` boolean.
 * Falls back to light mode when Vuetify is not present (e.g. isolated unit tests).
 */
export function useThemeMode(mode: () => ThemeModeProp | undefined): ComputedRef<boolean> {
  let vuetifyDark: () => boolean = () => false
  try {
    const vt = useTheme()
    vuetifyDark = () => vt.global.current.value.dark === true
  } catch {
    // No Vuetify in tree — stays light unless `mode` overrides.
  }

  return computed(() => {
    const m = mode()
    if (m === 'dark') return true
    if (m === 'light') return false
    return vuetifyDark()
  })
}
