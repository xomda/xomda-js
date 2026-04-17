import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createVuetify } from 'vuetify'

import type { MenuItemConfig } from '../../Menu'
import { ContextMenu } from '../ContextMenu'

const vuetify = createVuetify()

beforeEach(() => {
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

const items: MenuItemConfig[] = [{ key: 'a', title: 'Alpha' }]

describe('ContextMenu', () => {
  it('attaches a contextmenu listener to its parent element', () => {
    const onOpen = vi.fn()
    const Host = defineComponent({
      setup: () => () => (
        <div data-test="host">
          host
          <ContextMenu items={items} onOpen={onOpen} />
        </div>
      ),
    })
    const w = mount(Host, { global: { plugins: [vuetify] }, attachTo: document.body })
    const host = w.find('[data-test="host"]').element as HTMLElement
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onOpen).toHaveBeenCalledOnce()
    w.unmount()
  })

  it('prevents the default browser menu and stops propagation', () => {
    const outerHandler = vi.fn()
    const Host = defineComponent({
      setup: () => () => (
        <div ref="outer" onContextmenu={outerHandler}>
          <div data-test="inner">
            inner
            <ContextMenu items={items} />
          </div>
        </div>
      ),
    })
    const w = mount(Host, { global: { plugins: [vuetify] }, attachTo: document.body })
    const inner = w.find('[data-test="inner"]').element as HTMLElement
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    inner.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    // Outer handler (added with `onContextmenu` on the outer div) must not
    // run, because ContextMenu calls stopPropagation.
    expect(outerHandler).not.toHaveBeenCalled()
    w.unmount()
  })

  it('nested ContextMenus: inner fires, outer does not', () => {
    const outerOpen = vi.fn()
    const innerOpen = vi.fn()
    const Host = defineComponent({
      setup: () => () => (
        <div>
          outer
          <ContextMenu items={items} onOpen={outerOpen} />
          <div data-test="inner">
            inner
            <ContextMenu items={items} onOpen={innerOpen} />
          </div>
        </div>
      ),
    })
    const w = mount(Host, { global: { plugins: [vuetify] }, attachTo: document.body })
    const inner = w.find('[data-test="inner"]').element as HTMLElement
    inner.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(innerOpen).toHaveBeenCalledOnce()
    expect(outerOpen).not.toHaveBeenCalled()
    w.unmount()
  })

  it('opening one ContextMenu closes any other that is already open', async () => {
    const Host = defineComponent({
      setup: () => () => (
        <div>
          <div data-test="a">
            a
            <ContextMenu items={items} />
          </div>
          <div data-test="b">
            b
            <ContextMenu items={items} />
          </div>
        </div>
      ),
    })
    const w = mount(Host, { global: { plugins: [vuetify] }, attachTo: document.body })
    const a = w.find('[data-test="a"]').element as HTMLElement
    const b = w.find('[data-test="b"]').element as HTMLElement

    a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }))
    // Two microtask + paint cycles for VMenu's overlay to land in the DOM.
    await new Promise((r) => setTimeout(r, 0))
    await w.vm.$nextTick()
    expect(document.querySelectorAll('.v-overlay--active').length).toBe(1)

    b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }))
    await new Promise((r) => setTimeout(r, 0))
    await w.vm.$nextTick()
    // Still only one overlay open — the first one was closed before the
    // second one opened.
    expect(document.querySelectorAll('.v-overlay--active').length).toBe(1)
    w.unmount()
  })

  it('disabled: lets the default browser menu through', () => {
    const onOpen = vi.fn()
    const Host = defineComponent({
      setup: () => () => (
        <div data-test="host">
          host
          <ContextMenu items={items} disabled onOpen={onOpen} />
        </div>
      ),
    })
    const w = mount(Host, { global: { plugins: [vuetify] }, attachTo: document.body })
    const host = w.find('[data-test="host"]').element as HTMLElement
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    host.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(false)
    expect(onOpen).not.toHaveBeenCalled()
    w.unmount()
  })
})
