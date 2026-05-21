/**
 * Typed route names contributed by the model module. Other code references
 * routes by importing this table and passing `{ name: ModelRoutes.view }`
 * to `router.push` / `<RouterLink>` — never the path string.
 */
export const ModelRoutes = {
  view: 'model.view',
} as const

export type ModelRouteName = (typeof ModelRoutes)[keyof typeof ModelRoutes]
