import { mount } from '@vue/test-utils'
import { useNotificationsStore } from '@xomda/ui'
import { clearLogs, logger } from '@xomda/util'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'

import { AppNav } from '../AppNav'

const vuetify = createVuetify()

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/logs', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
    ],
  })

const mountNav = async (pinia: ReturnType<typeof createPinia>) => {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  return mount(AppNav, {
    global: { plugins: [vuetify, pinia, router] },
  })
}

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  clearLogs()
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  clearLogs()
})

describe('AppNav bottom rail', () => {
  it('hides the Notifications & Logs button when there are no logs or notifications', async () => {
    const w = await mountNav(pinia)
    expect(w.find('[aria-label="Notifications & Logs"]').exists()).toBe(false)
  })

  it('reveals the button (with a primary dot badge) once a notification lands', async () => {
    const w = await mountNav(pinia)
    useNotificationsStore().info('something happened')
    await nextTick()
    const btn = w.find('[aria-label="Notifications & Logs"]')
    expect(btn.exists()).toBe(true)
    // VBadge renders a `.v-badge__badge` element when active.
    expect(btn.find('.v-badge__badge').exists()).toBe(true)
  })

  it('also reveals when only a logger entry exists (no live notification)', async () => {
    logger.info('startup', { data: { ok: true } })
    const w = await mountNav(pinia)
    // Logger ring is polled on a 1s interval, but the initial sync at mount
    // already reads the current count.
    expect(w.find('[aria-label="Notifications & Logs"]').exists()).toBe(true)
  })

  it('renders the bottom rail in order: dark-mode → logs → preferences', async () => {
    useNotificationsStore().info('seed')
    const w = await mountNav(pinia)
    await nextTick()
    const labels = w
      .findAll('button[aria-label]')
      .map((b) => b.attributes('aria-label') ?? '')
      .filter((l) =>
        [
          'Switch to light mode',
          'Switch to dark mode',
          'Notifications & Logs',
          'Preferences',
        ].includes(l)
      )
    const themeIdx = labels.findIndex(
      (l) => l === 'Switch to light mode' || l === 'Switch to dark mode'
    )
    const logsIdx = labels.indexOf('Notifications & Logs')
    const prefsIdx = labels.indexOf('Preferences')
    expect(themeIdx).toBeGreaterThanOrEqual(0)
    expect(logsIdx).toBeGreaterThan(themeIdx)
    expect(prefsIdx).toBeGreaterThan(logsIdx)
  })
})
