import { defineComponent } from 'vue'

import { __confirmInternals } from '../../composables/useConfirm'
import { ConfirmDialog } from './ConfirmDialog'

export const ConfirmDialogHost = defineComponent({
  name: 'ConfirmDialogHost',
  setup() {
    const { state, onConfirm, onCancel, onUpdateModelValue } = __confirmInternals
    return () => (
      <ConfirmDialog
        modelValue={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        confirmColor={state.confirmColor}
        confirmVariant={state.confirmVariant}
        persistent={state.persistent}
        loading={state.loading}
        onUpdate:modelValue={onUpdateModelValue}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
  },
})
