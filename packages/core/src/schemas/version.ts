import { z } from 'zod'

export const VersionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  message: z.string().optional(),
  author: z.string().optional(),
  parent: z.string().uuid().nullable(),
  snapshotFilename: z.string().min(1),
  timestamp: z.string().datetime(),
})

export const VersionsIndexSchema = z.object({
  head: z.string().uuid().nullable().default(null),
  versions: z.array(VersionSchema).default([]),
})

export const SnapshotEnvelopeSchema = z.object({
  versionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  label: z.string(),
  message: z.string().optional(),
  author: z.string().optional(),
  parent: z.string().uuid().nullable(),
  model: z.unknown(),
})

export type Version = z.infer<typeof VersionSchema>
export type VersionsIndex = z.infer<typeof VersionsIndexSchema>
export type SnapshotEnvelope = z.infer<typeof SnapshotEnvelopeSchema>
