import { DraftIcon, FolderIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'

import { PluginIcon } from './PluginIcon'

export const FileEntryIcon = defineComponent({
  name: 'FileEntryIcon',
  props: {
    isDirectory: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String as PropType<string | null>,
      default: null,
    },
    size: {
      type: Number,
      default: 24,
    },
    color: {
      type: String as PropType<string | null>,
      default: null,
    },
    /**
     * Replaces the default file/folder glyph entirely. Accepts either an
     * SVG path string (monochrome Material Symbol — Vuetify-native) or a
     * full `<svg>…</svg>` markup string (multi-colour brand glyph from
     * devicons). Used to render a plugin-contributed file icon (e.g.
     * Maven for `pom.xml`) in place of the generic draft glyph — no
     * overlay, no tacked-on decoration.
     */
    primaryIcon: {
      type: String as PropType<string | null>,
      default: null,
    },
    /**
     * CSS color for the `primaryIcon`. Multi-color brand glyphs (full
     * SVGs) ignore this and keep their own palette; monochrome path
     * strings inherit it via `currentColor`.
     */
    primaryColor: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  setup(props) {
    return () => {
      const size = props.size
      const customIconSize = Math.round(size / 3)
      const offset = Math.round((size - customIconSize) / 2)

      // Plugin icon takes over the whole glyph — no default underneath,
      // no overlay. Brand SVGs keep their own colors regardless of
      // `primaryColor`; monochrome path strings pick it up via
      // currentColor.
      //
      // Brand SVGs fill their viewBox edge-to-edge, while material
      // path data used for the default file/folder glyph has ~2px of
      // built-in padding. Shrinking SVGs to ~82% and centering them
      // inside the requested size keeps them visually balanced next to
      // the rest of the tree.
      if (props.primaryIcon) {
        const isFullSvg = props.primaryIcon.startsWith('<')
        const inner = isFullSvg ? Math.round(size * 0.82) : size
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: `${size}px`,
              height: `${size}px`,
              flexShrink: 0,
            }}
          >
            <PluginIcon
              icon={props.primaryIcon}
              size={inner}
              color={props.primaryColor ?? undefined}
            />
          </span>
        )
      }

      const baseIcon = props.isDirectory ? FolderIcon : DraftIcon

      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          style={{ display: 'inline-block', flexShrink: 0 }}
        >
          <path d={baseIcon} fill={props.color ?? 'currentColor'} />
          {props.icon && (
            <foreignObject x={offset} y={offset} width={customIconSize} height={customIconSize}>
              <PluginIcon icon={props.icon} size={customIconSize} />
            </foreignObject>
          )}
        </svg>
      )
    }
  },
})
