import { defineComponent, type PropType } from 'vue'
import { VIcon } from 'vuetify/components'

import { SvgIcon } from '../SvgIcon'

/**
 * Renders an analysis-plugin icon — either a monochrome Material
 * Symbols path string (Vuetify-native, routed through `<VIcon>`) or a
 * full multi-colour `<svg>…</svg>` brand glyph (devicon, routed through
 * `<SvgIcon>`). Discriminates on the leading `<` so a single render
 * site copes with both shapes that `@xomda/icons` exports.
 *
 * `color` only applies to the path-string branch; brand SVGs ignore it
 * and keep their own palette.
 */
export const PluginIcon = defineComponent({
  name: 'PluginIcon',
  props: {
    icon: { type: String, required: true },
    size: { type: [Number, String] as PropType<number | string>, default: 24 },
    label: { type: String as PropType<string | undefined>, default: undefined },
    color: { type: String as PropType<string | undefined>, default: undefined },
  },
  setup(props) {
    return () =>
      props.icon.startsWith('<') ? (
        <SvgIcon svg={props.icon} size={props.size} label={props.label} />
      ) : (
        <VIcon icon={props.icon} size={props.size} color={props.color} aria-label={props.label} />
      )
  },
})
