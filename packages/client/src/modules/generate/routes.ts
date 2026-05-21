/**
 * Typed route names contributed by the generate module. Other code
 * references routes by importing this table and passing
 * `{ name: GenerateRoutes.view }` to `router.push` / `<RouterLink>` —
 * never the path string.
 */
export const GenerateRoutes = {
  view: 'generate.view',
} as const

export type GenerateRouteName = (typeof GenerateRoutes)[keyof typeof GenerateRoutes]
