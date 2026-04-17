// Side-effect import: registers every built-in module into the registry.
// Must happen at file scope (vitest isolates module state per test file,
// so an earlier file's `resetModuleRegistry()` doesn't affect us).
import '../../modules/registerAll'

import { describe, expect, it } from 'vitest'

import { getRegisteredModules } from '../../modules'

/**
 * Invariants every built-in module's route contributions must satisfy.
 * If a new module ships without a `name` or with a duplicate name, this
 * spec is the early-warning. See AGENTS.md "UI layout patterns" — every
 * module owns a typed `routes.ts`.
 */
describe('module-contributed routes', () => {
  it('every contributed route has a non-empty string `name`', () => {
    for (const mod of getRegisteredModules()) {
      for (const route of mod.routes ?? []) {
        expect(
          typeof route.name === 'string' && route.name.length > 0,
          `module "${mod.id}" route "${String(route.path)}" is missing a name`
        ).toBe(true)
      }
    }
  })

  it('route names are unique across all modules', () => {
    const seen = new Map<string, string>()
    for (const mod of getRegisteredModules()) {
      for (const route of mod.routes ?? []) {
        const name = String(route.name)
        const previousOwner = seen.get(name)
        expect(
          previousOwner,
          `duplicate route name "${name}" in modules "${previousOwner}" and "${mod.id}"`
        ).toBeUndefined()
        seen.set(name, mod.id)
      }
    }
  })

  it('every nav contribution references a route the same module defines', () => {
    for (const mod of getRegisteredModules()) {
      if (!mod.nav) continue
      const ownRouteNames = (mod.routes ?? []).map((r) => String(r.name))
      expect(
        ownRouteNames.includes(mod.nav.routeName),
        `module "${mod.id}" nav.routeName "${mod.nav.routeName}" does not match any of its routes`
      ).toBe(true)
    }
  })
})
