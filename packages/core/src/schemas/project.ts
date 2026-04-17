import { z } from 'zod'

import { VersionsIndexSchema } from './version'

// Sorted to keep the persisted JSON stable — adding/removing one entry
// produces a minimal diff rather than reshuffling the whole array.
const SortedStringsSchema = z
  .array(z.string().min(1))
  .default([])
  .transform((arr) => [...new Set(arr)].sort())

/**
 * Folder names skipped during the subproject scan. Either as a bare
 * folder name (matched anywhere in the tree) or as a project-relative
 * path. Defaults to common machine-managed dirs and the .xomda
 * marker itself.
 */
const DEFAULT_SCAN_EXCLUDES = [
  '.git',
  '.idea',
  '.vscode',
  '.xomda',
  'build',
  'dist',
  'node_modules',
  'out',
  'target',
] as const

export const DEFAULT_PROJECT_SCAN_EXCLUDES: readonly string[] = DEFAULT_SCAN_EXCLUDES

export const ProjectSettingsSchema = z
  .object({
    /**
     * When true (default), writes outside the project root are rejected.
     * No silent redirection: callers get a typed error and decide.
     */
    restrictWritesToProjectRoot: z.boolean().default(true),
    /**
     * When true, this is a "root" xomda project — subproject scans don't
     * recurse into it (other than to list it as a leaf), and walking up
     * from it stops cold. Use to mark a workspace boundary you don't
     * want crossed.
     */
    isRoot: z.boolean().default(false),
    /**
     * Folder names to skip during subproject discovery. Each entry is
     * either a folder basename (matched anywhere) or a project-relative
     * path. Sorted + deduped on parse for diff stability.
     */
    excludeFromScan: SortedStringsSchema.default([...DEFAULT_SCAN_EXCLUDES]),
    /**
     * Maximum number of attribute rows shown inside an entity on the
     * diagram before the list becomes vertically scrollable. Defaults to
     * 10 — a sane balance between dense models and not turning every
     * entity into a postage stamp.
     */
    diagramMaxEntityAttributes: z.number().int().min(1).max(200).default(10),
    /**
     * Maximum number of value rows shown inside an enum on the diagram
     * before the list becomes vertically scrollable. Defaults to 10 for
     * the same reasons as `diagramMaxEntityAttributes`.
     */
    diagramMaxEnumValues: z.number().int().min(1).max(200).default(10),
  })
  .loose()

export const ProjectFileSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    versions: VersionsIndexSchema.default(() => ({ head: null, versions: [] })),
    settings: ProjectSettingsSchema.default(() => ({
      restrictWritesToProjectRoot: true,
      isRoot: false,
      excludeFromScan: [...DEFAULT_SCAN_EXCLUDES],
      diagramMaxEntityAttributes: 10,
      diagramMaxEnumValues: 10,
    })),
    /**
     * Sorted list of analysis-plugin ids that are active for this
     * project. Populated either on first scan or by the user explicitly
     * via the Settings page. An empty array means "auto-detect" — the
     * server returns everything that matches, treating no persisted
     * preference as no filter.
     */
    plugins: SortedStringsSchema,
  })
  .loose()

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>
export type ProjectFile = z.infer<typeof ProjectFileSchema>

/**
 * The default ProjectSettings shape — useful when initialising a new
 * project on the client without re-listing every field. Returns a fresh
 * object on every call so callers can mutate freely.
 */
export const defaultProjectSettings = (): ProjectSettings => ProjectSettingsSchema.parse({})
