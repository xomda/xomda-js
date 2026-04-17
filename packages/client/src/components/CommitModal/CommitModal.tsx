import { useAsyncState, useVersion } from '@xomda/ui'
import { computed, defineComponent, type PropType, ref, watch } from 'vue'
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VTextarea,
  VTextField,
} from 'vuetify/components'

import { trpc } from '../../trpc'

export const CommitModal = defineComponent({
  name: 'CommitModal',
  props: {
    modelValue: { type: Boolean, default: false },
    /** The model's current `version` attribute — the version we're publishing from. */
    currentVersion: { type: String, default: '' },
    /** All known historical version labels; used to enforce strict-greater on publish. */
    knownVersionLabels: { type: Array as PropType<string[]>, default: () => [] },
  },
  emits: {
    'update:modelValue': null as unknown as (value: boolean) => true,
    committed: null as unknown as (versionId: string) => true,
  },
  setup(props, { emit }) {
    const version = useVersion()
    const upcoming = ref('')
    const message = ref('')
    const { loading, error, run } = useAsyncState<{ id: string }>()

    const resetUpcoming = (): void => {
      const prefilled = version.bump(props.currentVersion)
      upcoming.value = prefilled ?? ''
    }

    watch(
      () => props.modelValue,
      (open) => {
        if (open) {
          resetUpcoming()
          message.value = ''
          error.value = null
        }
      }
    )

    const upcomingError = computed(() =>
      version.validateUpcoming(upcoming.value, props.currentVersion, props.knownVersionLabels)
    )

    const close = (): void => {
      emit('update:modelValue', false)
      upcoming.value = ''
      message.value = ''
      error.value = null
    }

    const commit = (): void => {
      if (upcomingError.value) return
      run(async () => {
        const created = await trpc.model.commitVersion.mutate({
          upcomingVersion: upcoming.value.trim(),
          message: message.value.trim() || undefined,
        })
        emit('committed', created.id)
        close()
        return created
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
          <VCardTitle>Publish a new version</VCardTitle>
          <VCardText>
            <p class="text-body-2 text-grey mb-3">
              Publish the current state of the model as a new immutable version. You can keep
              editing afterwards on the upcoming version.
            </p>
            <p class="text-body-2 mt-2 mb-6">
              Version to publish: <strong>{props.currentVersion || '—'}</strong>
            </p>
            <VTextField
              v-model={upcoming.value}
              label="Upcoming version"
              placeholder="1.0.1"
              variant="outlined"
              autofocus
              hide-details={upcomingError.value ? false : 'auto'}
              errorMessages={upcomingError.value ?? undefined}
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
              disabled={upcomingError.value != null}
            >
              Publish
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    )
  },
})
