import type { AuthorSchema } from '@generated/AuthorSchema'
import type { z } from 'zod'

export type Author = z.infer<typeof AuthorSchema>
