import { defineComponent, type PropType } from 'vue'
import { VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VSpacer } from 'vuetify/components'

export const ConfirmDialog = defineComponent({
  name: 'ConfirmDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    confirmLabel: { type: String, default: 'Confirm' },
    cancelLabel: { type: String, default: 'Cancel' },
    confirmColor: { type: String, default: 'primary' },
    confirmVariant: {
      type: String as PropType<'flat' | 'text' | 'elevated' | 'tonal' | 'outlined' | 'plain'>,
      default: 'tonal',
    },
    loading: { type: Boolean, default: false },
    persistent: { type: Boolean, default: false },
    maxWidth: { type: [Number, String], default: 400 },
  },
  emits: {
    'update:modelValue': (_value: boolean) => true,
    confirm: () => true,
    cancel: () => true,
  },
  setup(props, { emit, slots }) {
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
        persistent={props.persistent}
      >
        {{
          default: () => (
            <VCard rounded="xl">
              <VCardTitle class="pt-5 px-6">{props.title}</VCardTitle>
              <VCardText>{slots.default ? slots.default() : props.message}</VCardText>
              <VCardActions class="px-6 pb-5">
                <VSpacer />
                <VBtn variant="text" disabled={props.loading} onClick={onCancel}>
                  {props.cancelLabel}
                </VBtn>
                <VBtn
                  variant={props.confirmVariant}
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
