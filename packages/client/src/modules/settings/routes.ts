/**
 * Typed route names contributed by the settings module. Other code
 * references routes by importing this table and passing
 * `{ name: SettingsRoutes.view }` to `router.push` / `<RouterLink>` —
 * never the path string.
 */
export const SettingsRoutes = {
  view: 'settings.view',
} as const

export type SettingsRouteName = (typeof SettingsRoutes)[keyof typeof SettingsRoutes]
