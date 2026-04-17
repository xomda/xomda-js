import { mount } from '@vue/test-utils'
import { PluginTypeScriptIcon } from '@xomda/icons'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { FileEntryListItem } from '../FileEntryListItem'
import styles from '../FileEntryListItem.module.scss'

const vuetify = createVuetify()

const mountItem = (
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) =>
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
    const wrapper = mountItem({ name: 'thing.ts', iconOverlay: PluginTypeScriptIcon })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).props('icon')).toBe(
      PluginTypeScriptIcon
    )
  })

  it('uses parent-folder icon when isParent is true', () => {
    const wrapper = mountItem({ name: '..', isParent: true })
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).exists()).toBe(false)
  })

  it('icon slot fully overrides the prepend icon', () => {
    const wrapper = mountItem(
      { name: 'thing', isDirectory: true },
      { icon: () => '<span class="custom-icon">X</span>' }
    )
    expect(wrapper.findComponent({ name: 'FileEntryIcon' }).exists()).toBe(false)
    expect(wrapper.html()).toContain('custom-icon')
  })

  it('renders append slot content', () => {
    const wrapper = mountItem({ name: 'thing' }, { append: () => '<span class="badge">G</span>' })
    expect(wrapper.html()).toContain('badge')
  })

  it('applies the right-padding override so the append menu aligns with the panel header', () => {
    // VListItem defaults to `padding-inline: 16px`, which pushes any append
    // slot 12px inward of the matching MoreIcon in ViewCardHeader (which sits
    // 4px from the right edge). The override class shrinks the right padding
    // so the two menus share a column.
    const wrapper = mountItem({ name: 'thing.ts' })
    expect(wrapper.find('.v-list-item').classes()).toContain(styles.item)
  })

  it('merges the override class with a consumer-provided class', () => {
    // FolderListView passes its own `class` through; the override must not
    // clobber it.
    const wrapper = mount(FileEntryListItem, {
      props: { name: 'thing.ts' },
      attrs: { class: 'consumer-class' },
      global: { plugins: [vuetify] },
    })
    const classes = wrapper.find('.v-list-item').classes()
    expect(classes).toContain(styles.item)
    expect(classes).toContain('consumer-class')
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
