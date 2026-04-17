import { DeleteIcon } from '@xomda/icons'
import { SidePanel } from '@xomda/ui'
import type { PropType } from 'vue'
import { defineComponent } from 'vue'
import type { JSXComponent } from 'vuetify'
import { VBtn, VDivider } from 'vuetify/components'

export interface PropertyPanelDeleteAction {
  /** Button label (`'Delete Attribute'`, `'Delete Entity'`, …). */
  label: string
  /** Click handler — typically opens a confirm dialog and runs the delete mutation. */
  onConfirm: () => void
}

/**
 * Shared chrome for the five "properties of the selected …" panels
 * that used to live inline in ModelView.tsx — one each for the
 * Attribute / Entity / Enum / Package / Model-meta selection. All
 * five had the same SidePanel + section-label + form-slot + divider
 * + optional-delete + footer-with-Cancel/Save skeleton (~60 LOC each).
 *
 * Form-specific content (the DynamicForm + fieldOverrides + any
 * additional kind-specific UI) goes in the default slot. The
 * \`onSave\` / \`onCancel\` callbacks fire when the user clicks the
 * footer buttons; \`canSave\` (typically \`buffer.dirty.value\`)
 * disables the Save button.
 */
export const PropertyPanel = defineComponent({
  name: 'PropertyPanel',
  props: {
    /** Class to forward to the underlying SidePanel (e.g. the layout-grid class). */
    panelClass: { type: String, default: undefined },
    /** SidePanel title — typically the constant string `'Properties'`. */
    title: { type: String, default: 'Properties' },
    /**
     * Icon for the SidePanel header. SidePanel's `icon` prop is typed
     * `string` (Material symbol name) but Vuetify accepts any
     * `JSXComponent` at runtime — we widen the contract here so call
     * sites can pass `@xomda/icons` components directly.
     */
    icon: { type: [String, Object, Function] as PropType<JSXComponent | string>, required: true },
    /**
     * Subhead inside the body (`'Attribute'`, `'Entity'`, …) — keeps
     * the user oriented when several property panels would otherwise
     * look identical.
     */
    sectionLabel: { type: String, required: true },
    /** Whether the Save button is enabled. Typically `buffer.dirty.value`. */
    canSave: { type: Boolean, default: true },
    /**
     * Optional delete action — when set, renders a tonal error-coloured
     * Delete button below the form (separated by VDivider).
     */
    deleteAction: { type: Object as PropType<PropertyPanelDeleteAction>, default: null },
  },
  emits: {
    save: () => true,
    cancel: () => true,
    close: () => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <SidePanel
        class={props.panelClass}
        title={props.title}
        // SidePanel's `icon` prop is typed `string` (Material symbol name)
        // but Vuetify also renders JSXComponent icons at runtime.
        icon={props.icon as unknown as string}
        elevation={4}
        onClose={() => emit('cancel')}
      >
        {{
          default: () => (
            <>
              <div class="text-overline mb-4">{props.sectionLabel}</div>
              {slots.default?.()}
              {props.deleteAction && (
                <>
                  <VDivider class="mb-6" />
                  <VBtn
                    color="error"
                    variant="tonal"
                    block
                    prepend-icon={DeleteIcon}
                    onClick={() => props.deleteAction?.onConfirm()}
                  >
                    {props.deleteAction.label}
                  </VBtn>
                </>
              )}
            </>
          ),
          footer: () => (
            <>
              <VBtn variant="text" onClick={() => emit('cancel')}>
                Cancel
              </VBtn>
              <VBtn
                variant="tonal"
                color="primary"
                disabled={!props.canSave}
                onClick={() => emit('save')}
              >
                Save
              </VBtn>
            </>
          ),
        }}
      </SidePanel>
    )
  },
})
