/**
 * Typed route names contributed by the home module. Other code references
 * routes by importing this table and passing `{ name: HomeRoutes.view }`
 * to `router.push` / `<RouterLink>` — never the path string.
 */
export const HomeRoutes = {
  view: 'home.view',
} as const

export type HomeRouteName = (typeof HomeRoutes)[keyof typeof HomeRoutes]
