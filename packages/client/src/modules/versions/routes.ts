/**
 * Typed route names contributed by the versions module. Other code
 * references routes by importing this table and passing
 * `{ name: VersionsRoutes.view }` to `router.push` / `<RouterLink>` —
 * never the path string.
 */
export const VersionsRoutes = {
  view: 'versions.view',
} as const

export type VersionsRouteName = (typeof VersionsRoutes)[keyof typeof VersionsRoutes]
