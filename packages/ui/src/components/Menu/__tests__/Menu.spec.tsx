import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { Menu, MenuDivider, MenuItem, type MenuItemConfig, MenuSubheader } from '../'

const vuetify = createVuetify()

const mountMenu = (props: Record<string, unknown> = {}, slots: Record<string, any> = {}) =>
  mount(Menu, {
    props,
    slots,
    global: { plugins: [vuetify] },
  })

describe('Menu', () => {
  it('renders items from the items prop', () => {
    const items: MenuItemConfig[] = [{ title: 'Rename' }, { title: 'Delete', color: 'error' }]
    const wrapper = mountMenu({ items })
    expect(wrapper.text()).toContain('Rename')
    expect(wrapper.text()).toContain('Delete')
    expect(wrapper.findAllComponents(MenuItem)).toHaveLength(2)
  })

  it('renders default-slot children', () => {
    const wrapper = mount(Menu, {
      slots: {
        default: () => [<MenuItem title="One" />, <MenuItem title="Two" />],
      },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.text()).toContain('One')
    expect(wrapper.text()).toContain('Two')
  })

  it('renders dividers and subheaders from items', () => {
    const items: MenuItemConfig[] = [
      { subheader: 'Actions' },
      { title: 'Rename' },
      { divider: true },
      { title: 'Delete', color: 'error' },
    ]
    const wrapper = mountMenu({ items })
    expect(wrapper.findComponent(MenuSubheader).exists()).toBe(true)
    expect(wrapper.findComponent(MenuDivider).exists()).toBe(true)
    expect(wrapper.text()).toContain('Actions')
  })

  it('forwards click on an item', async () => {
    const onClick = vi.fn()
    const items: MenuItemConfig[] = [{ title: 'Rename', onClick }]
    const wrapper = mountMenu({ items })
    await wrapper.find('.v-list-item').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('marks disabled items as disabled', () => {
    const items: MenuItemConfig[] = [{ title: 'Disabled', disabled: true }]
    const wrapper = mountMenu({ items })
    expect(wrapper.find('.v-list-item').classes()).toContain('v-list-item--disabled')
  })

  it('renders a shortcut hint in the append slot', () => {
    const items: MenuItemConfig[] = [{ title: 'Save', shortcut: '⌘S' }]
    const wrapper = mountMenu({ items })
    expect(wrapper.text()).toContain('⌘S')
  })

  it('renders both items and slot children when both are provided', () => {
    const wrapper = mount(Menu, {
      props: { items: [{ title: 'FromProp' } satisfies MenuItemConfig] },
      slots: { default: () => <MenuItem title="FromSlot" /> },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.text()).toContain('FromProp')
    expect(wrapper.text()).toContain('FromSlot')
  })

  it('renders nothing notable when no items and no slot', () => {
    const wrapper = mountMenu()
    expect(wrapper.findAllComponents(MenuItem)).toHaveLength(0)
  })

  it('renders a submenu activator with the configured title and chevron', () => {
    const items: MenuItemConfig[] = [
      {
        title: 'More',
        submenu: [{ title: 'Inner one' }, { title: 'Inner two' }],
      },
    ]
    const wrapper = mountMenu({ items })
    expect(wrapper.text()).toContain('More')
    const activator = wrapper.findComponent(MenuItem)
    expect(activator.exists()).toBe(true)
    expect(activator.props('title')).toBe('More')
    expect(activator.props('appendIcon')).toBeTruthy()
  })
})
