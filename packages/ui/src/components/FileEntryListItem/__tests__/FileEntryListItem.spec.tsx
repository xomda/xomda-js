import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { FileEntryListItem } from '../FileEntryListItem'

const vuetify = createVuetify()

const mountItem = (props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) =>
  mount(FileEntryListItem, {
    props: { name: 'thing', ...props },
    slots,
    global: { plugins: [vuetify] },
  })

describe('FileEntryListItem', () => {
  it('renders the name as title', () => {
    const wrapper = mountItem({ name: 'README.md' })
    expect(wrapper.text()).toContain('README.md')
  })

  it('renders subtitle when provided', () => {
    const wrapper = mountItem({ name: 'README.md', subtitle: '1.2 KB' })
    expect(wrapper.text()).toContain('1.2 KB')
  })

  it('renders default folder icon for directories', () => {
    const wrapper = mountItem({ name: 'src', isDirectory: true })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).props('isDirectory')).toBe(true)
  })

  it('renders default file icon for non-directories', () => {
    const wrapper = mountItem({ name: 'thing.ts', isDirectory: false })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).props('isDirectory')).toBe(false)
  })

  it('forwards iconOverlay to FileEntryIcon', () => {
    const wrapper = mountItem({ name: 'thing.ts', iconOverlay: 'devicon:typescript' })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).props('icon')).toBe('devicon:typescript')
  })

  it('uses parent-folder icon when isParent is true', () => {
    const wrapper = mountItem({ name: '..', isParent: true })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).exists()).toBe(false)
  })

  it('icon slot fully overrides the prepend icon', () => {
    const wrapper = mountItem(
      { name: 'thing', isDirectory: true },
      { icon: () => '<span class="custom-icon">X</span>' },
    )
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).exists()).toBe(false)
    expect(wrapper.html()).toContain('custom-icon')
  })

  it('renders append slot content', () => {
    const wrapper = mountItem(
      { name: 'thing' },
      { append: () => '<span class="badge">G</span>' },
    )
    expect(wrapper.html()).toContain('badge')
  })

  it('forwards click through to the listener', async () => {
    const onClick = vi.fn()
    const wrapper = mount(FileEntryListItem, {
      props: { name: 'thing' },
      attrs: { onClick },
      global: { plugins: [vuetify] },
    })
    await wrapper.find('.v-list-item').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
