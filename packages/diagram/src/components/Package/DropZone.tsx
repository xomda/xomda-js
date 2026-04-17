import { useDropZone } from '@vueuse/core'
import { defineComponent, ref } from 'vue'

import styles from './Package.module.scss'

export const DropZone = defineComponent({
  name: 'DropZone',
  props: {
    index: { type: Number, required: true },
    targetPackageId: { type: String, required: false },
  },
  emits: ['drop-item'],
  setup(props, { emit }) {
    const el = ref<HTMLElement | null>(null)

    // `files` will always be [] since the payload is not a File — read from event.dataTransfer
    const { isOverDropZone } = useDropZone(el, {
      dataTypes: ['application/x-xomda-diagram'],
      onDrop(_, event) {
        const data = event.dataTransfer?.getData('application/x-xomda-diagram')
        if (!data) return
        event.preventDefault()
        event.stopPropagation()
        const parsed = JSON.parse(data) as { type: string; id: string }
        emit('drop-item', {
          type: parsed.type,
          id: parsed.id,
          targetPackageId: props.targetPackageId,
          index: props.index,
        })
      },
    })

    return () => (
      <div ref={el} class={[styles.dropZone, isOverDropZone.value && styles.dropZoneActive]} />
    )
  },
})
