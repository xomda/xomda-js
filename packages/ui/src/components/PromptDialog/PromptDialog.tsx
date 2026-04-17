import { defineComponent } from 'vue'
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VSpacer,
  VTextField,
} from 'vuetify/components'

export const PromptDialog = defineComponent({
  name: 'PromptDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    value: { type: String, default: '' },
    confirmLabel: { type: String, default: 'OK' },
    cancelLabel: { type: String, default: 'Cancel' },
    confirmColor: { type: String, default: 'primary' },
    error: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    maxWidth: { type: [Number, String], default: 420 },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    'update:value': (_value: string) => true,
    confirm: () => true,
    cancel: () => true,
  },
  setup(props, { emit }) {
    const onCancel = () => {
      emit('cancel')
      emit('update:modelValue', false)
    }
    const onConfirm = () => emit('confirm')
    return () => (
      <VDialog
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit('update:modelValue', v)}
        max-width={props.maxWidth}
        persistent={props.loading}
      >
        {{
          default: () => (
            <VCard rounded="xl">
              <VCardTitle class="pt-5 px-6">{props.title}</VCardTitle>
              <VCardText>
                {props.message && <p class="text-body-2 mb-3">{props.message}</p>}
                <VTextField
                  modelValue={props.value}
                  onUpdate:modelValue={(v: string) => emit('update:value', v)}
                  label={props.label}
                  placeholder={props.placeholder}
                  variant="outlined"
                  density="compact"
                  autofocus
                  errorMessages={props.error ? [props.error] : []}
                  hideDetails={props.error ? false : 'auto'}
                  onKeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') onConfirm()
                  }}
                />
              </VCardText>
              <VCardActions class="px-6 pb-5">
                <VSpacer />
                <VBtn variant="text" disabled={props.loading} onClick={onCancel}>
                  {props.cancelLabel}
                </VBtn>
                <VBtn
                  variant="tonal"
                  color={props.confirmColor}
                  loading={props.loading}
                  onClick={onConfirm}
                >
                  {props.confirmLabel}
                </VBtn>
              </VCardActions>
            </VCard>
          ),
        }}
      </VDialog>
    )
  },
})
