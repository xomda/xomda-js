import { z, type ZodTypeAny } from 'zod'

import { getEffectiveAttributes } from '../inheritance/index'
import { findEntityByName, findEnumByName } from '../introspect/index'
import type { Attribute, PrimitiveType } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Model } from '../schemas/model'

// Typed as `Record<PrimitiveType, …>` so the compiler enforces completeness
// against the canonical PRIMITIVE_TYPES list — adding a new primitive without
// a builder is now a compile error.
const PRIMITIVE_BUILDERS: Record<PrimitiveType, () => ZodTypeAny> = {
  string: () => z.string(),
  number: () => z.number(),
  decimal: () => z.number(),
  boolean: () => z.boolean(),
  date: () => z.string().datetime(),
  uuid: () => z.string().uuid(),
}

/**
 * Build a Zod base type for a single attribute, using the live model to
 * resolve enum / entity references. Does *not* apply optional / array wrapping
 * — see `buildAttributeSchema` for the wrapped version.
 */
function buildAttributeBase(attr: Attribute, model: Model, visiting: Set<string>): ZodTypeAny {
  // Reference fields are stored as the referenced element's id.
  if (attr.reference) return z.string().uuid()

  const primitive = PRIMITIVE_BUILDERS[attr.type as PrimitiveType]
  if (primitive) return primitive()

  // Enum reference → z.enum(values)
  const enumDef = findEnumByName(model, attr.type)
  if (enumDef) {
    const values = enumDef.values.map((v) => v.name)
    return values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string()
  }

  // Embedded entity reference → recursively build its schema (with cycle guard)
  const entityDef = findEntityByName(model, attr.type)
  if (entityDef) {
    if (visiting.has(entityDef.id)) {
      // Cycle: fall back to a passthrough object to avoid infinite recursion.
      return z.object({}).loose()
    }
    return buildEntitySchemaInternal(entityDef, model, visiting)
  }

  // Unknown type — accept anything so user data round-trips.
  return z.unknown()
}

/**
 * Wrap a single attribute's base schema with array/optional/default modifiers
 * driven by `multiValue`, `required`, `primaryKey`, and `defaultValue`.
 */
function buildAttributeSchema(
  attr: Attribute & { defaultValue?: string },
  model: Model,
  visiting: Set<string>
): ZodTypeAny {
  let schema: ZodTypeAny = buildAttributeBase(attr, model, visiting)

  // Required-string convention from the static schema mirror.
  if (attr.required && attr.type === 'string' && !attr.defaultValue) {
    schema = z.string().min(1)
  }

  // Defaults
  if (attr.primaryKey && attr.type === 'uuid') {
    schema = (schema as z.ZodString).default(() => crypto.randomUUID())
  } else if (attr.defaultValue !== undefined && attr.defaultValue !== '') {
    const isString = attr.type === 'string'
    const defaultVal: unknown = isString
      ? attr.defaultValue
      : attr.type === 'number' || attr.type === 'decimal'
        ? Number(attr.defaultValue)
        : attr.type === 'boolean'
          ? attr.defaultValue === 'true'
          : attr.defaultValue
    schema = (schema as z.ZodTypeAny & { default: (v: unknown) => ZodTypeAny }).default(defaultVal)
  } else if (attr.type === 'boolean') {
    schema = (schema as z.ZodBoolean).default(false)
  }

  if (attr.multiValue) {
    schema = z.array(schema).default([])
  } else if (!attr.required && !attr.primaryKey) {
    schema = schema.optional()
  }

  return schema
}

function buildEntitySchemaInternal(
  entity: Entity,
  model: Model,
  visiting: Set<string>
): ZodTypeAny {
  visiting.add(entity.id)
  const shape: Record<string, ZodTypeAny> = {}
  for (const attr of getEffectiveAttributes(entity, model)) {
    shape[attr.name] = buildAttributeSchema(attr, model, visiting)
  }
  visiting.delete(entity.id)
  return z.object(shape).loose()
}

/**
 * Build a Zod schema reflecting an entity's **effective** attribute list (own
 * attributes plus those inherited via the `extends` chain). Resolves enum and
 * entity references against the live `model`.
 *
 * Use this when you need a stricter validator than the open `EntitySchema` —
 * for example, validating that a Tier-2 user's domain instance honours the
 * fields contributed by `SpecialEntity extends Entity`.
 *
 * The returned schema is `.loose()` so unknown keys still round-trip.
 *
 * Cycle handling: if an embedded entity reference forms a cycle, the cyclic
 * branch falls back to a permissive `z.object({}).loose()` rather than
 * recursing infinitely.
 */
export function buildEntitySchema(entity: Entity, model: Model): ZodTypeAny {
  return buildEntitySchemaInternal(entity, model, new Set())
}
