import { defineComponent, type PropType } from 'vue'

import styles from './SvgIcon.module.scss'

/**
 * Renders a raw `<svg>…</svg>` markup string at the given size. Used for
 * multi-colour brand glyphs (devicons) that ship in `@xomda/icons` as
 * full SVG markup so their per-path `fill="#…"` attributes survive
 * intact — Vuetify's `mdi-svg` set can only render single-path
 * monochrome icons.
 *
 * The host `<span>` exists because `innerHTML` is an Element property —
 * Vue fragments have no DOM element to attach it to. CSS sizes the
 * nested `<svg>` to fill the host so a `size` prop drives both axes.
 */
export const SvgIcon = defineComponent({
  name: 'SvgIcon',
  props: {
    svg: { type: String, required: true },
    size: { type: [Number, String] as PropType<number | string>, default: 24 },
    label: { type: String as PropType<string | undefined>, default: undefined },
  },
  setup(props) {
    return () => (
      <span
        class={styles.root}
        role="img"
        aria-label={props.label}
        style={{
          width: typeof props.size === 'number' ? `${props.size}px` : props.size,
          height: typeof props.size === 'number' ? `${props.size}px` : props.size,
        }}
        // SVG markup is hand-authored / vendored from `devicon` at build
        // time — no untrusted input flows into here, so `innerHTML` is
        // safe. See `packages/icons/src/icons/devicons.ts`.
        innerHTML={props.svg}
      />
    )
  },
})
