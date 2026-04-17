import { Icon } from '@iconify/vue'
import { DraftIcon, FolderIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'

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
  },
  setup(props) {
    return () => {
      const baseIcon = props.isDirectory ? FolderIcon : DraftIcon
      const size = props.size
      const customIconSize = Math.round(size / 3)
      const offset = Math.round((size - customIconSize) / 2)

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
              <Icon
                icon={props.icon}
                width={customIconSize}
                height={customIconSize}
                style={{ display: 'block' }}
              />
            </foreignObject>
          )}
        </svg>
      )
    }
  },
})
