import { z } from 'zod'

/**
 * Branded ID types for the model graph.
 *
 * Every ID in the model graph is a UUID v4 at runtime, so all of these
 * structurally widen to `string`. The brand is a compile-time phantom
 * marker that lets TypeScript distinguish an `EntityId` from a `PackageId`,
 * catching the "wrong kind of ID" bug at the type system level without
 * any runtime cost.
 *
 * One-way assignability:
 *
 *     const e: EntityId = somePackageId   // ✗ TS error — what we want
 *     const s: string   = someEntityId    // ✓ — brand widens to string
 *     const e: EntityId = 'some-raw-uuid' // ✗ — needs schema or cast
 *
 * The last constraint is the entry-point guard: a raw string only
 * becomes a branded ID by going through the corresponding `…IdSchema`
 * (which validates UUID shape) or via an explicit cast at a boundary
 * where the shape is already known.
 *
 * Adopt these gradually — typing a function parameter or a Pinia store
 * field as `EntityId` is opt-in and additive. Existing untyped string-
 * parameter APIs accept branded IDs transparently (string widening).
 */

export const EntityIdSchema = z.string().uuid().brand<'EntityId'>()
export const EnumIdSchema = z.string().uuid().brand<'EnumId'>()
export const PackageIdSchema = z.string().uuid().brand<'PackageId'>()
export const AttributeIdSchema = z.string().uuid().brand<'AttributeId'>()
export const EnumValueIdSchema = z.string().uuid().brand<'EnumValueId'>()
export const TemplateIdSchema = z.string().uuid().brand<'TemplateId'>()
export const ModelIdSchema = z.string().uuid().brand<'ModelId'>()

export type EntityId = z.infer<typeof EntityIdSchema>
export type EnumId = z.infer<typeof EnumIdSchema>
export type PackageId = z.infer<typeof PackageIdSchema>
export type AttributeId = z.infer<typeof AttributeIdSchema>
export type EnumValueId = z.infer<typeof EnumValueIdSchema>
export type TemplateId = z.infer<typeof TemplateIdSchema>
export type ModelId = z.infer<typeof ModelIdSchema>

/**
 * Lifting helpers: take a string known to be a UUID at this call site
 * and stamp the appropriate brand without going through Zod parsing.
 * Use only when the input has already been validated upstream (e.g. it
 * came out of a schema-parsed object). Prefer the `…IdSchema` parsers
 * at trust boundaries.
 */
export const asEntityId = (s: string): EntityId => s as EntityId
export const asEnumId = (s: string): EnumId => s as EnumId
export const asPackageId = (s: string): PackageId => s as PackageId
export const asAttributeId = (s: string): AttributeId => s as AttributeId
export const asEnumValueId = (s: string): EnumValueId => s as EnumValueId
export const asTemplateId = (s: string): TemplateId => s as TemplateId
export const asModelId = (s: string): ModelId => s as ModelId
