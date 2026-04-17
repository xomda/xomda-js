// Public API of the module system. Note: this barrel exposes the registry
// and helpers — it does NOT side-effect-import any modules. Use
// `./registerAll` for that (kept separate so tests can import the API
// without booting every built-in module).
export {
  getEventBus,
  getModule,
  getRegisteredModules,
  initializeModules,
  registerModule,
  resetModuleRegistry,
} from './registry'
export type { ModuleContext, XomdaModule, XomdaModuleNav } from './types'
export { useEventBus, useModule } from './useModule'
