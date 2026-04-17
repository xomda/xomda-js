import { z } from 'zod'

/**
 * Identifies which workspace-resident model a router call targets.
 *
 * - `root`: project root directory (absolute, or relative to the server's
 *   cwd). When omitted, defaults to the server cwd — the original
 *   single-project behaviour.
 * - `modelId`: UUID of a specific model. When omitted, the primary model
 *   at `<root>/.xomda/model.json` is used.
 *
 * Merged into every model.* and template.* router input via
 * `Schema.merge(SelectorSchema)` so callers can opt in without rewiring.
 */
export const SelectorSchema = z.object({
  root: z.string().optional(),
  modelId: z.string().uuid().optional(),
})

export type Selector = z.infer<typeof SelectorSchema>
