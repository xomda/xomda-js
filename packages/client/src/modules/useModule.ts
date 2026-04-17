import { getEventBus, getModule } from './registry'

/**
 * Resolve another module's public API (the value its `setup()` returned),
 * or `undefined` if the module is unknown / didn't expose anything.
 *
 *   const sel = useModule<ModelSelection>('model')
 *
 * Typed: pass the module's exposed type as the generic argument.
 */
export function useModule<T = unknown>(id: string): T | undefined {
  return getModule<T>(id)
}

/** Access the app-wide event bus from any component. */
export function useEventBus() {
  return getEventBus()
}
