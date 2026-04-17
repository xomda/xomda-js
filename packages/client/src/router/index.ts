import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { getRegisteredModules } from '../modules'

/**
 * Routes are contributed by modules (`packages/client/src/modules/`). This
 * file just collects them and creates the router; no hardcoded list.
 */
function collectRoutes(): RouteRecordRaw[] {
  const out: RouteRecordRaw[] = []
  for (const mod of getRegisteredModules()) {
    if (!mod.routes) continue
    out.push(...mod.routes)
  }
  return out
}

export const router = createRouter({
  history: createWebHistory(),
  routes: collectRoutes(),
})
