import type { PropType } from 'vue'
import { defineComponent } from 'vue'
import {
  VAlert,
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VSpacer,
} from 'vuetify/components'

export interface CreateItemDialogValidationError {
  message: string
  path?: ReadonlyArray<string | number>
}

/**
 * Shared chrome for the four "Create new <Entity / Enum / Package /
 * Attribute>" dialogs that used to live inline in ModelView.tsx,
 * collapsing 4 × ~65 LOC of near-identical scaffolding into a single
 * component.
 *
 * The dialog owns the Vuetify wrappers (\`VDialog\` / \`VCard\` / title /
 * footer with Cancel + Create), the inline error stack
 * (\`VAlert\` per Zod-validation field error), and the button states
 * (\`loading\`, \`canCreate\`). The actual form lives in the default
 * slot — keep field overrides and form-specific keystroke handling
 * (Enter-to-create) at the call site.
 */
export const CreateItemDialog = defineComponent({
  name: 'CreateItemDialog',
  props: {
    /** Two-way binding for the dialog's open state. */
    open: { type: Boolean, required: true },
    /** Dialog title — typically `"New <kind> in <packageName>"`. */
    title: { type: String, required: true },
    /**
     * Zod field-level validation errors to show as inline alerts inside
     * the dialog body. \`null\` hides the error stack.
     */
    errors: {
      type: Array as PropType<ReadonlyArray<CreateItemDialogValidationError> | null>,
      default: null,
    },
    /** Wire to the mutation's `loading.value`. */
    loading: { type: Boolean, default: false },
    /**
     * Whether the create action is enabled. The dialog never decides
     * what "valid" means — typically `!!String(value.name ?? '').trim()`.
     */
    canCreate: { type: Boolean, default: true },
    /** Label on the primary button. Defaults to "Create". */
    createLabel: { type: String, default: 'Create' },
    /** Visual color of the primary button. Defaults to indigo (model brand). */
    createColor: { type: String, default: 'indigo' },
    /** Width clamp on the dialog. Defaults to 400 to match the inline form. */
    maxWidth: { type: Number, default: 400 },
  },
  emits: {
    /** Two-way binding for \`open\`. */
    'update:open': (_v: boolean) => true,
    /** User pressed the primary button. */
    create: () => true,
    /** User cancelled (Cancel button or backdrop dismiss). */
    cancel: () => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <VDialog
        modelValue={props.open}
        onUpdate:modelValue={(v: boolean) => {
          emit('update:open', v)
          if (!v) emit('cancel')
        }}
        max-width={props.maxWidth}
      >
        {{
          default: () => (
            <VCard rounded="xl">
              <VCardTitle class="pt-5 px-6">{props.title}</VCardTitle>
              <VCardText>
                {props.errors && props.errors.length > 0 && (
                  <div class="mb-4">
                    {props.errors.map((err, i) => (
                      <VAlert
                        key={i}
                        type="error"
                        variant="tonal"
                        density="compact"
                        class="mb-2"
                        text={err.message}
                      />
                    ))}
                  </div>
                )}
                {slots.default?.()}
              </VCardText>
              <VCardActions class="px-6 pb-5">
                <VSpacer />
                <VBtn
                  variant="text"
                  onClick={() => {
                    emit('update:open', false)
                    emit('cancel')
                  }}
                >
                  Cancel
                </VBtn>
                <VBtn
                  variant="tonal"
                  color={props.createColor}
                  loading={props.loading}
                  disabled={!props.canCreate}
                  onClick={() => emit('create')}
                >
                  {props.createLabel}
                </VBtn>
              </VCardActions>
            </VCard>
          ),
        }}
      </VDialog>
    )
  },
})
