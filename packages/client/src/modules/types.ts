import type { EventBus } from '@xomda/util'
import type { RouteRecordRaw } from 'vue-router'

/**
 * A module bundles every contribution one feature area makes to the
 * application: routes, nav entry, a setup hook (for stores / providers /
 * subscriptions), and an optional `exposes()` factory through which other
 * modules can reach into its public API.
 *
 * Built-in views are written as modules so the same shape can later host
 * 3rd-party extensions without a separate API surface.
 */
export interface XomdaModule<TExposed = unknown> {
  /** Stable, unique id (kebab-case). Used in `useModule(id)`. */
  id: string

  /** Routes contributed to the global router. */
  routes?: RouteRecordRaw[]

  /** Nav contribution (left rail). Omit to hide from nav. */
  nav?: XomdaModuleNav

  /**
   * Called once at app boot, before the router is created. Use for:
   * defining Pinia stores, providing app-wide injections, subscribing
   * to the bus. Anything returned becomes the module's public API
   * (the value returned by `useModule(id)`).
   *
   * Receives the runtime context so it can subscribe to the event bus
   * or reach other modules. Other modules are not guaranteed to be
   * registered yet at setup time — for cross-module access, prefer
   * resolving lazily inside callbacks/computeds.
   */
  setup?: (ctx: ModuleContext) => TExposed | void
}

export interface XomdaModuleNav {
  /**
   * Vuetify icon value — an SVG path string from `@xomda/icons` (e.g.
   * `HomeIcon`).
   */
  icon: string
  label: string
  /**
   * Name of the route this nav item navigates to (usually the module's
   * primary route). Always the typed constant from the module's
   * `routes.ts` — never a raw path string. AppNav builds
   * `{ name: routeName }` for both navigation and active-route matching,
   * so wildcard routes (`/files/:dirPath(.*)*`) light up correctly on
   * every nested path with no startsWith glue.
   */
  routeName: string
  /** Lower = earlier in the rail. Defaults to 100. */
  order?: number
}

export interface ModuleContext {
  /**
   * App-wide typed event bus. Modules emit/subscribe via this single
   * primitive instead of inventing their own. The event map is open
   * (`Record<string, unknown>`); module-specific event names should be
   * namespaced (`<moduleId>:<eventName>`) to avoid collisions.
   */
  bus: EventBus<Record<string, unknown>>

  /** Resolve another module's `exposes` value, or `undefined` if missing. */
  getModule<T = unknown>(id: string): T | undefined
}
