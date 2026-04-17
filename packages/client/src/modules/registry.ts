import { createEventBus, type EventBus } from '@xomda/util'

import type { ModuleContext, XomdaModule } from './types'

/**
 * Module registry. Modules call `registerModule(...)` at top-level (from
 * their own module file), so importing the module-aggregator (`./index.ts`)
 * wires every contribution. Same pattern as `@xomda/analysis-plugins-client`.
 */
const modules: XomdaModule[] = []
const exposed = new Map<string, unknown>()
let initialized = false

const bus: EventBus<Record<string, unknown>> = createEventBus()

const context: ModuleContext = {
  bus,
  getModule<T = unknown>(id: string): T | undefined {
    return exposed.get(id) as T | undefined
  },
}

export function registerModule<TExposed = unknown>(mod: XomdaModule<TExposed>): void {
  if (modules.some((m) => m.id === mod.id)) {
    // Idempotent: HMR or duplicate side-effect import shouldn't blow up.
    return
  }
  modules.push(mod as XomdaModule)
  // If setup() runs *after* `initializeModules()` has already fired (late
  // registration via dynamic import), run it now so the late module still
  // wires up — but its routes won't appear unless the router rebuilds.
  if (initialized && mod.setup) {
    const result = mod.setup(context)
    if (result !== undefined) exposed.set(mod.id, result)
  }
}

/**
 * Fire every module's `setup()` once, in registration order. Must be
 * called after Pinia is installed (so stores can be defined) and before
 * the router is built (so route contributions are available). See main.ts.
 */
export function initializeModules(): void {
  if (initialized) return
  initialized = true
  for (const mod of modules) {
    if (!mod.setup) continue
    const result = mod.setup(context)
    if (result !== undefined) exposed.set(mod.id, result)
  }
}

export function getRegisteredModules(): readonly XomdaModule[] {
  return modules
}

export function getModule<T = unknown>(id: string): T | undefined {
  return exposed.get(id) as T | undefined
}

/** App-wide event bus. Exposed for components that aren't modules themselves. */
export function getEventBus(): EventBus<Record<string, unknown>> {
  return bus
}

/** Test-only — wipe state so each spec starts clean. */
export function resetModuleRegistry(): void {
  modules.length = 0
  exposed.clear()
  bus.clear()
  initialized = false
}
