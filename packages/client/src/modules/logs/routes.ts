/**
 * Typed route names contributed by the logs module. Other code references
 * routes by importing this table and passing `{ name: LogsRoutes.view }`
 * to `router.push` / `<RouterLink>` — never the path string.
 */
export const LogsRoutes = {
  view: 'logs.view',
} as const

export type LogsRouteName = (typeof LogsRoutes)[keyof typeof LogsRoutes]
