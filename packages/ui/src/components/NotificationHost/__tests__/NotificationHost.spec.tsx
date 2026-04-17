import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'

import { useNotificationsStore } from '../../../stores/notifications'
import { NotificationHost } from '../NotificationHost'

const vuetify = createVuetify()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  // Vuetify checks visualViewport on layout — provide a stub in happy-dom.
  if (!window.visualViewport) {
    vi.stubGlobal('visualViewport', {
      width: 1024,
      height: 768,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  }
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const mountHost = () =>
  mount(NotificationHost, {
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

describe('NotificationHost', () => {
  it('renders a snackbar for each notification', async () => {
    const store = useNotificationsStore()
    store.info('hello')
    store.error('boom')
    mountHost()
    await nextTick()
    expect(document.body.textContent).toContain('hello')
    expect(document.body.textContent).toContain('boom')
  })

  it('renders nothing when the store is empty', async () => {
    mountHost()
    await nextTick()
    expect(document.body.querySelectorAll('.v-snackbar').length).toBe(0)
  })

  it('renders an `Nx ` prefix when a notification has been deduplicated', async () => {
    const store = useNotificationsStore()
    store.error('Save failed')
    store.error('Save failed')
    store.error('Save failed')
    mountHost()
    await nextTick()
    expect(document.body.textContent).toContain('3× Save failed')
  })

  it('does not render the count prefix when count is 1', async () => {
    const store = useNotificationsStore()
    store.error('Save failed')
    mountHost()
    await nextTick()
    expect(document.body.textContent).toContain('Save failed')
    expect(document.body.textContent).not.toMatch(/\d+× Save failed/)
  })

  it('separates polite (info/success) and assertive (warning/error) live regions', async () => {
    const store = useNotificationsStore()
    store.info('polite-info')
    store.success('polite-success')
    store.warning('assertive-warning')
    store.error('assertive-error')
    mountHost()
    await nextTick()

    const polite = document.querySelector('[aria-live="polite"]')!
    const assertive = document.querySelector('[aria-live="assertive"]')!
    expect(polite.textContent).toContain('polite-info')
    expect(polite.textContent).toContain('polite-success')
    expect(polite.textContent).not.toContain('assertive-')
    expect(assertive.textContent).toContain('assertive-warning')
    expect(assertive.textContent).toContain('assertive-error')
    expect(assertive.textContent).not.toContain('polite-')
  })

  it('auto-dismisses a notification after its timeout elapses', async () => {
    const store = useNotificationsStore()
    store.info('disappearing', { timeout: 1000 })
    mountHost()
    await nextTick()
    expect(store.items).toHaveLength(1)

    vi.advanceTimersByTime(999)
    expect(store.items).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.items).toHaveLength(0)
  })

  it('does NOT auto-dismiss a sticky (timeout=0) notification', async () => {
    const store = useNotificationsStore()
    store.error('sticky', { timeout: 0 })
    mountHost()
    await nextTick()
    vi.advanceTimersByTime(60_000)
    expect(store.items).toHaveLength(1)
  })

  it('refreshes the auto-dismiss timer on a dedup hit', async () => {
    const store = useNotificationsStore()
    store.error('boom', { timeout: 1000 })
    mountHost()
    await nextTick()

    vi.advanceTimersByTime(800)
    // Just before it would auto-dismiss, the same error fires again — timer resets.
    store.error('boom', { timeout: 1000 })
    await nextTick()
    vi.advanceTimersByTime(800)
    // Original schedule would have hit 1600ms; we're past 1000 but the refresh
    // restarted the clock, so the item should still be present.
    expect(store.items).toHaveLength(1)
    vi.advanceTimersByTime(300)
    expect(store.items).toHaveLength(0)
  })

  it('runs the action when its button is clicked and then dismisses', async () => {
    const store = useNotificationsStore()
    const run = vi.fn(async () => {})
    store.error('Could not save', { timeout: 0, action: { label: 'Retry', run } })
    mountHost()
    await nextTick()

    const retryBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Retry'
    )
    expect(retryBtn).toBeTruthy()
    retryBtn!.click()
    await vi.runAllTimersAsync()
    expect(run).toHaveBeenCalledOnce()
    expect(store.items).toHaveLength(0)
  })

  it('surfaces a fresh error notification when the action callback throws (and dismisses the original)', async () => {
    const store = useNotificationsStore()
    const run = vi.fn(async () => {
      throw new Error('retry blew up')
    })
    store.error('boom', { timeout: 0, action: { label: 'Retry', run } })
    mountHost()
    await nextTick()

    const retryBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Retry'
    )
    retryBtn!.click()
    // Drain microtasks for the async click handler — don't advance fake
    // timers (that would also auto-dismiss the replacement notification).
    await flushPromises()
    await flushPromises()
    // The original notification was dismissed; a new error surfaced the
    // action's own failure so the user knows the retry didn't work.
    expect(store.items.map((n) => n.message)).toEqual([
      expect.stringMatching(/Action failed: retry blew up/),
    ])
  })

  it('dismiss button removes the notification immediately', async () => {
    const store = useNotificationsStore()
    store.info('clickme', { timeout: 0 })
    mountHost()
    await nextTick()

    const closeBtn = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss notification"]'
    )
    expect(closeBtn).toBeTruthy()
    closeBtn!.click()
    await nextTick()
    expect(store.items).toHaveLength(0)
  })

  it('cleans up all pending timers on unmount', async () => {
    const store = useNotificationsStore()
    store.info('a', { timeout: 5000 })
    store.error('b', { timeout: 5000 })
    const wrapper = mountHost()
    await nextTick()
    wrapper.unmount()
    // Advancing the timer must not throw / mutate the now-detached store.
    expect(() => vi.advanceTimersByTime(60_000)).not.toThrow()
    expect(store.items).toHaveLength(2) // store entries linger — host owned only the timers
  })
})
