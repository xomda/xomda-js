import type { ParsedVersion, VersionPart } from '@xomda/model'
import {
  bumpVersion,
  compareVersions,
  isValidVersion,
  maxVersion,
  parseVersion,
  validateModelVersionEdit,
  validateUpcomingVersion,
} from '@xomda/model'

export type { ParsedVersion, VersionPart }

/**
 * Semver-ish version utilities — parse, compare, bump, and validate.
 * Re-exports the pure helpers from `@xomda/core` (via `@xomda/model`) so callers
 * inside the UI layer have a single, conventional `use*` entry point.
 */
export function useVersion(): {
  parse: typeof parseVersion
  isValid: typeof isValidVersion
  compare: typeof compareVersions
  bump: typeof bumpVersion
  max: typeof maxVersion
  validateUpcoming: typeof validateUpcomingVersion
  validateEdit: typeof validateModelVersionEdit
} {
  return {
    parse: parseVersion,
    isValid: isValidVersion,
    compare: compareVersions,
    bump: bumpVersion,
    max: maxVersion,
    validateUpcoming: validateUpcomingVersion,
    validateEdit: validateModelVersionEdit,
  }
}
