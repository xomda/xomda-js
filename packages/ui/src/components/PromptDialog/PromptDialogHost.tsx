import { defineComponent } from 'vue'

import { __promptInternals } from '../../composables/usePrompt'
import { PromptDialog } from './PromptDialog'

export const PromptDialogHost = defineComponent({
  name: 'PromptDialogHost',
  setup() {
    const { state, onConfirm, onCancel, onUpdateModelValue, onUpdateValue } = __promptInternals
    return () => (
      <PromptDialog
        modelValue={state.open}
        title={state.title}
        message={state.message}
        label={state.label}
        placeholder={state.placeholder}
        value={state.value}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        confirmColor={state.confirmColor}
        error={state.error}
        loading={state.loading}
        onUpdate:modelValue={onUpdateModelValue}
        onUpdate:value={onUpdateValue}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
  },
})
