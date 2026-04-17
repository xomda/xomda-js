import type { Attribute, Entity, Model, Package } from '@xomda/core'
import type { JsonObject } from 'type-fest'
import { defineComponent, type PropType, type VNode } from 'vue'
import { VCheckbox, VSelect, VTextField } from 'vuetify/components'

import { useModelEnum } from '../composables/useModelEntity'

const PRIMITIVE_TYPES = new Set(['string', 'number', 'decimal', 'boolean', 'date', 'uuid'])

/**
 * Collects all instances of a given type-name across the model. Currently
 * supports xomda's standard nested collections: 'Entity', 'Enum', 'Package'.
 */
function collectInstancesByType(typeName: string, model: Model): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  const walk = (pkg: Package): void => {
    if (typeName === 'Entity') {
      for (const e of pkg.entities) out.push({ id: e.id, name: e.name })
    } else if (typeName === 'Enum') {
      for (const e of pkg.enums) out.push({ id: e.id, name: e.name })
    } else if (typeName === 'Package') {
      for (const p of pkg.packages) out.push({ id: p.id, name: p.name })
    }
    for (const sub of pkg.packages) walk(sub)
  }
  for (const pkg of model.packages) walk(pkg)
  return out
}

export interface FieldRenderContext {
  attribute: Attribute
  value: unknown
  /** Update a single field's value. Persistence happens later via the parent's Save action. */
  onUpdate: (next: unknown) => void
}

export const DynamicForm = defineComponent({
  name: 'DynamicForm',
  props: {
    /** Entity definition that drives which fields render. */
    entity: { type: Object as PropType<Entity>, required: true },
    /** Form data, keyed by attribute name. */
    modelValue: { type: Object as PropType<JsonObject>, default: () => ({}) },
    /** Optional: full Model — needed to resolve Enum references for VSelect items. */
    model: { type: Object as PropType<Model | null>, default: null },
    /** Per-field render override, keyed by attribute name. Return null to skip rendering the field. */
    fieldOverrides: {
      type: Object as PropType<Record<string, (ctx: FieldRenderContext) => VNode | null>>,
      default: () => ({}),
    },
    /** Hide attributes flagged as primaryKey (typically the id). Default: true. */
    hidePrimaryKey: { type: Boolean, default: true },
  },
  emits: {
    'update:modelValue': (_value: JsonObject) => true,
  },
  setup(props, { emit }) {
    const renderField = (attr: Attribute): VNode | null => {
      if (props.hidePrimaryKey && attr.primaryKey) return null

      const value = props.modelValue[attr.name]
      const update = (next: unknown) => {
        emit('update:modelValue', { ...props.modelValue, [attr.name]: next } as JsonObject)
      }

      const override = props.fieldOverrides[attr.name]
      if (override) {
        return override({ attribute: attr, value, onUpdate: update })
      }

      // Boolean → checkbox
      if (attr.type === 'boolean') {
        return (
          <VCheckbox
            modelValue={Boolean(value)}
            label={labelFor(attr)}
            hide-details
            density="compact"
            class="mb-2"
            onUpdate:modelValue={(v: boolean | null) => update(Boolean(v))}
          />
        )
      }

      // Number-like
      if (attr.type === 'number' || attr.type === 'decimal') {
        return (
          <VTextField
            hide-details
            modelValue={value == null ? '' : String(value)}
            label={labelFor(attr)}
            type="number"
            variant="outlined"
            density="compact"
            class="mb-2"
            onUpdate:modelValue={(v: string) => update(v === '' ? null : Number(v))}
          />
        )
      }

      // Date
      if (attr.type === 'date') {
        return (
          <VTextField
            hide-details
            modelValue={value == null ? '' : String(value)}
            label={labelFor(attr)}
            type="date"
            variant="outlined"
            density="compact"
            class="mb-2"
            onUpdate:modelValue={(v: string) => update(v)}
          />
        )
      }

      // Reference to a non-primitive instance → VSelect of all instances of that type.
      // Self-references are filtered out when the target type matches the entity
      // being edited (prevents `extends` pointing at the entity itself).
      if (attr.reference && !PRIMITIVE_TYPES.has(attr.type) && props.model) {
        const items = collectInstancesByType(attr.type, props.model)
          .filter((it) => {
            if (attr.type === props.entity.name) {
              return it.id !== props.modelValue.id
            }
            return true
          })
          .sort((a, b) => a.name.localeCompare(b.name))
        return (
          <VSelect
            hide-details
            modelValue={value == null ? null : String(value)}
            label={labelFor(attr)}
            items={items.map((it) => ({ title: it.name, value: it.id }))}
            variant="outlined"
            density="compact"
            class="mb-2"
            clearable={!attr.required}
            onUpdate:modelValue={(v: string | null) => update(v ?? undefined)}
          />
        )
      }

      // Enum reference → VSelect from enum values
      if (!PRIMITIVE_TYPES.has(attr.type) && props.model) {
        const enumDef = useModelEnum(props.model, attr.type).value
        if (enumDef) {
          return (
            <VSelect
              hide-details
              modelValue={value == null ? null : String(value)}
              label={labelFor(attr)}
              items={enumDef.values.map((v) => v.name)}
              variant="outlined"
              density="compact"
              class="mb-4"
              clearable={!attr.required}
              onUpdate:modelValue={(v: string | null) => update(v)}
            />
          )
        }
      }

      // Default: string (and unresolved entity refs fall through to text)
      return (
        <VTextField
          hide-details
          modelValue={value == null ? '' : String(value)}
          label={labelFor(attr)}
          variant="outlined"
          density="compact"
          class="mb-4"
          onUpdate:modelValue={(v: string) => update(v)}
        />
      )
    }

    return () => (
      <div>
        {props.entity.attributes.map((attr) => {
          const node = renderField(attr)
          return node ? <div key={attr.id}>{node}</div> : null
        })}
      </div>
    )
  },
})

function labelFor(attr: Attribute): string {
  // Convert camelCase / lowercase to a human-readable label.
  const spaced = attr.name.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
