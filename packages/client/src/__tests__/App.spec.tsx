import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'

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
