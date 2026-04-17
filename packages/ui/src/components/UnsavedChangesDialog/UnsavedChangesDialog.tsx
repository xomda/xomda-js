import { defineComponent } from 'vue'
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VSpacer,
} from 'vuetify/components'

export const UnsavedChangesDialog = defineComponent({
  name: 'UnsavedChangesDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'Unsaved changes' },
    message: { type: String, default: 'You have unsaved changes. Save them before closing?' },
    saveLabel: { type: String, default: 'Save' },
    discardLabel: { type: String, default: 'Discard' },
    cancelLabel: { type: String, default: 'Cancel' },
    loading: { type: Boolean, default: false },
    persistent: { type: Boolean, default: false },
    maxWidth: { type: [Number, String], default: 440 },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    save: () => true,
    discard: () => true,
    cancel: () => true,
  },
  setup(props, { emit, slots }) {
    const onSave = () => emit('save')
    const onDiscard = () => {
      emit('discard')
      emit('update:modelValue', false)
    }
    const onCancel = () => {
      emit('cancel')
      emit('update:modelValue', false)
    }

    return () => (
      <VDialog
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit('update:modelValue', v)}
        max-width={props.maxWidth}
        persistent={props.persistent}
      >
        {{
          default: () => (
            <VCard rounded="xl">
              <VCardTitle class="pt-5 px-6">{props.title}</VCardTitle>
              <VCardText>{slots.default ? slots.default() : props.message}</VCardText>
              <VCardActions class="px-6 pb-5">
                <VBtn variant="text" color="error" disabled={props.loading} onClick={onDiscard}>
                  {props.discardLabel}
                </VBtn>
                <VSpacer />
                <VBtn variant="text" disabled={props.loading} onClick={onCancel}>
                  {props.cancelLabel}
                </VBtn>
                <VBtn variant="tonal" color="primary" loading={props.loading} onClick={onSave}>
                  {props.saveLabel}
                </VBtn>
              </VCardActions>
            </VCard>
          ),
        }}
      </VDialog>
    )
  },
})
