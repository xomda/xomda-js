import { defineComponent, ref } from 'vue'
import { VBtn, VCard, VCardActions, VCardText, VCardTitle, VDialog, VTextarea,VTextField } from 'vuetify/components'

import { useAsyncState } from '../../composables'
import { trpc } from '../../trpc'

export const CommitModal = defineComponent({
  name: 'CommitModal',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': null as unknown as (value: boolean) => true,
    committed: null as unknown as (versionId: string) => true,
  },
  setup(props, { emit }) {
    const label = ref('')
    const message = ref('')
    const { loading, error, execute } = useAsyncState<{ id: string }>()

    const close = (): void => {
      emit('update:modelValue', false)
      label.value = ''
      message.value = ''
      error.value = null
    }

    const commit = (): void => {
      if (!label.value.trim()) return
      execute(async () => {
        const version = await trpc.model.commitVersion.mutate({
          label: label.value.trim(),
          message: message.value.trim() || undefined,
        })
        emit('committed', version.id)
        close()
        return version
      })
    }

    return () => (
      <VDialog
        modelValue={props.modelValue}
        onUpdate:modelValue={(v) => emit('update:modelValue', !!v)}
        max-width="500"
        persistent={loading.value}
      >
        <VCard>
          <VCardTitle>Commit version</VCardTitle>
          <VCardText>
            <p class="text-body-2 text-grey mb-3">
              Save the current state of the model as a new immutable version. You can keep editing
              afterwards on top of this version.
            </p>
            <VTextField
              v-model={label.value}
              label="Label"
              placeholder="v1.0"
              variant="outlined"
              autofocus
              hide-details="auto"
              class="mb-3"
            />
            <VTextarea
              v-model={message.value}
              label="Message (optional)"
              variant="outlined"
              rows={3}
              hide-details="auto"
            />
            {error.value && <p class="text-error text-body-2 mt-2">{error.value}</p>}
          </VCardText>
          <VCardActions>
            <VBtn variant="text" onClick={close} disabled={loading.value}>
              Cancel
            </VBtn>
            <VBtn
              color="primary"
              variant="elevated"
              onClick={commit}
              loading={loading.value}
              disabled={!label.value.trim()}
            >
              Commit
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    )
  },
})
