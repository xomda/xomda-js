import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'

// Stub the workspace tRPC query: mounting <App> fires `workspace.load()` in
// onMounted, which otherwise hits the network. With no backend the fetch hangs
// and happy-dom aborts it at teardown, printing a DOMException [AbortError] —
// clutter that risks a load-dependent flake. This is the only tRPC call App
// makes at mount (AppNav/hosts fetch lazily on user action).
vi.mock('../trpc', () => ({
  trpc: {
    project: {
      workspace: {
        query: () =>
          Promise.resolve({
            workspace: { root: '/', name: 'test', models: [] },
            subprojects: [],
          }),
      },
    },
  },
}))

import { App } from '../App'

const vuetify = createVuetify()
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })

describe('App', () => {
  it('renders without errors', () => {
    const wrapper = mount(App, {
      global: { plugins: [vuetify, createPinia(), makeRouter()] },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders the app navigation', () => {
    const wrapper = mount(App, {
      global: { plugins: [vuetify, createPinia(), makeRouter()] },
    })
    expect(wrapper.findComponent({ name: 'AppNav' }).exists()).toBe(true)
  })
})
