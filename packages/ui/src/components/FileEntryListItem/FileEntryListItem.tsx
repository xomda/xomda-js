import { ParentFolderIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import { VIcon, VListItem } from 'vuetify/components'

import { FileEntryIcon } from '../FileEntryIcon'

export const FileEntryListItem = defineComponent({
  name: 'FileEntryListItem',
  inheritAttrs: false,
  props: {
    name: { type: String, required: true },
    subtitle: { type: String, default: undefined },
    isDirectory: { type: Boolean, default: false },
    isParent: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    color: { type: String as PropType<string | undefined>, default: undefined },
    iconColor: { type: String as PropType<string | null>, default: null },
    iconOverlay: { type: String as PropType<string | null>, default: null },
    prependGap: { type: Number, default: 16 },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const iconSlot =
        slots.icon ??
        (props.isParent
          ? () => <VIcon icon={ParentFolderIcon} />
          : () => (
              <FileEntryIcon
                isDirectory={props.isDirectory}
                icon={props.iconOverlay}
                color={props.iconColor}
              />
            ))

      return (
        <VListItem
          {...attrs}
          prependGap={props.prependGap}
          title={props.name}
          subtitle={props.subtitle}
          active={props.active}
          color={props.color}
        >
          {{
            prepend: iconSlot,
            ...(slots.append ? { append: slots.append } : {}),
          }}
        </VListItem>
      )
    }
  },
})
