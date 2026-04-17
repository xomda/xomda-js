import { z } from 'zod'

// Open by design (`.passthrough()`): see EntitySchema for rationale.
export const EnumValueSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().min(1),
  })
  .loose()

export const EnumSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    name: z.string().min(1),
    values: z.array(EnumValueSchema).default([]),
    description: z.string().optional(),
  })
  .loose()
  .superRefine((data, ctx) => {
    const names = new Set<string>()
    data.values.forEach((val, index) => {
      if (names.has(val.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Enum value "${val.name}" must be unique within an enum`,
          path: ['values', index, 'name'],
        })
      }
      names.add(val.name)
    })
  })

export type Enum = z.infer<typeof EnumSchema>
export type EnumValue = z.infer<typeof EnumValueSchema>
