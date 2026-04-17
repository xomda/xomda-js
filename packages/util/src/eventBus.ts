/**
 * Typed event bus. Framework-agnostic; safe to use from any package.
 *
 * Each module declares its event map as a phantom type; consumers get
 * autocompletion + payload type-checking on emit/on. Handlers run
 * synchronously in insertion order; throws in one handler do not stop
 * the others (logged via console.error to avoid losing them silently).
 *
 * Usage:
 *   type ModelEvents = { 'selection-change': { id: string } }
 *   const bus = createEventBus<ModelEvents>()
 *   const off = bus.on('selection-change', (p) => { ... })
 *   bus.emit('selection-change', { id: 'abc' })
 *   off()
 */
export type EventHandler<T> = (payload: T) => void

export interface EventBus<TEvents extends Record<string, unknown>> {
  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void
  once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void
  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void
  /** Drop every handler. Test-only. */
  clear(): void
}

export function createEventBus<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
>(): EventBus<TEvents> {
  const handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>()

  function getSet<K extends keyof TEvents>(event: K): Set<EventHandler<unknown>> {
    let set = handlers.get(event)
    if (!set) {
      set = new Set()
      handlers.set(event, set)
    }
    return set
  }

  return {
    on(event, handler) {
      const set = getSet(event)
      set.add(handler as EventHandler<unknown>)
      return () => set.delete(handler as EventHandler<unknown>)
    },
    once(event, handler) {
      const off = this.on(event, (payload) => {
        off()
        handler(payload)
      })
      return off
    },
    off(event, handler) {
      handlers.get(event)?.delete(handler as EventHandler<unknown>)
    },
    emit(event, payload) {
      const set = handlers.get(event)
      if (!set || set.size === 0) return
      // Copy to allow handlers to unsubscribe during emit without skipping siblings.
      for (const h of [...set]) {
        try {
          h(payload)
        } catch (e) {
          // Don't break the chain; one bad handler shouldn't stop the rest.
          console.error(`[eventBus] handler for "${String(event)}" threw`, e)
        }
      }
    },
    clear() {
      handlers.clear()
    },
  }
}
