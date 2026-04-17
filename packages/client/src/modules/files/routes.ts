/**
 * Typed route names contributed by the files module. Other code references
 * routes by importing this table and passing `{ name: FilesRoutes.browse }`
 * to `router.push` / `<RouterLink>` — never the path string.
 */
export const FilesRoutes = {
  browse: 'files.browse',
} as const

export type FilesRouteName = (typeof FilesRoutes)[keyof typeof FilesRoutes]
