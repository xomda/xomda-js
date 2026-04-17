import { defineComponent } from 'vue'

import { __unsavedChangesInternals } from '../../composables/useUnsavedChangesPrompt'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'

export const UnsavedChangesDialogHost = defineComponent({
  name: 'UnsavedChangesDialogHost',
  setup() {
    const { state, onSave, onDiscard, onCancel, onUpdateModelValue } = __unsavedChangesInternals
    return () => (
      <UnsavedChangesDialog
        modelValue={state.open}
        title={state.title}
        message={state.message}
        saveLabel={state.saveLabel}
        discardLabel={state.discardLabel}
        cancelLabel={state.cancelLabel}
        persistent={state.persistent}
        loading={state.loading}
        onUpdate:modelValue={onUpdateModelValue}
        onSave={onSave}
        onDiscard={onDiscard}
        onCancel={onCancel}
      />
    )
  },
})
