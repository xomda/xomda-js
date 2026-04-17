import { defineComponent, type PropType } from 'vue'
import { type RouteLocationRaw, RouterLink } from 'vue-router'
import { VChip } from 'vuetify/components'

import styles from './Version.module.scss'

/**
 * Display a semver version string in a consistent monospace style.
 *
 * Modes:
 * - default: inline text (monospace, optional prefix)
 * - `chip`: render as a `VChip` (small, tonal); ideal for badge-style placement
 *
 * Optional navigation:
 * - `to` → wraps the rendered version in `<RouterLink>`
 * - `href` → wraps in `<a>`
 * - (neither) → plain `<span>` / `<VChip>`
 *
 * Pass both `to` and `href` only if you mean to (router takes precedence).
 */
export const Version = defineComponent({
  name: 'Version',
  props: {
    /** Semver string, e.g. "1.0.0". Empty string renders the `placeholder`. */
    version: { type: String, required: true },
    /** Prefix shown before the version (e.g. "v"). Empty by default. */
    prefix: { type: String, default: '' },
    /** Render as a Vuetify chip instead of inline text. */
    chip: { type: Boolean, default: false },
    /** Chip size when `chip` is true. */
    size: {
      type: String as PropType<'x-small' | 'small' | 'default'>,
      default: 'small',
    },
    /** Vuetify color for chip mode (defaults to a neutral surface tone). */
    color: { type: String, default: undefined },
    /** Vue Router navigation target. Wraps the version in `<RouterLink>`. */
    to: { type: [String, Object] as PropType<RouteLocationRaw | undefined>, default: undefined },
    /** Plain anchor href. Used only when `to` is not provided. */
    href: { type: String, default: undefined },
    /** Fallback text when `version` is empty (e.g. unsaved/initial state). */
    placeholder: { type: String, default: '—' },
  },
  setup(props) {
    return () => {
      const label = props.version ? `${props.prefix}${props.version}` : props.placeholder

      if (props.chip) {
        const chip = (
          <VChip class={styles.chip} size={props.size} color={props.color} variant="tonal" label>
            {label}
          </VChip>
        )
        if (props.to)
          return (
            <RouterLink to={props.to} class={styles.link}>
              {chip}
            </RouterLink>
          )
        if (props.href)
          return (
            <a href={props.href} class={styles.link}>
              {chip}
            </a>
          )
        return chip
      }

      const text = <span class={styles.version}>{label}</span>
      if (props.to)
        return (
          <RouterLink to={props.to} class={styles.link}>
            {text}
          </RouterLink>
        )
      if (props.href)
        return (
          <a href={props.href} class={styles.link}>
            {text}
          </a>
        )
      return text
    }
  },
})
