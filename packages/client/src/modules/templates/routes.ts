/**
 * Typed route names contributed by the templates module. Other code
 * references routes by importing this table and passing
 * `{ name: TemplatesRoutes.view }` to `router.push` / `<RouterLink>` —
 * never the path string.
 */
export const TemplatesRoutes = {
  view: 'templates.view',
} as const

export type TemplatesRouteName = (typeof TemplatesRoutes)[keyof typeof TemplatesRoutes]
