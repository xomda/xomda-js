import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { HexView } from '../HexView'

describe('HexView', () => {
  it('renders the byte count in the header', () => {
    const bytes = new Uint8Array([0x48, 0x69])
    const wrapper = mount(HexView, { props: { bytes } })
    expect(wrapper.text()).toContain('2 bytes')
  })

  it('formats hex pairs with leading zeros', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff])
    const wrapper = mount(HexView, { props: { bytes } })
    const text = wrapper.text()
    expect(text).toContain('00')
    expect(text).toContain('0f')
    expect(text).toContain('ff')
  })

  it('renders printable ASCII verbatim and substitutes a dot otherwise', () => {
    const bytes = new Uint8Array([0x48, 0x69, 0x00, 0x7f])
    const wrapper = mount(HexView, { props: { bytes } })
    expect(wrapper.text()).toContain('Hi..')
  })

  it('groups rows of 16 bytes and shows offsets', () => {
    const bytes = new Uint8Array(32)
    const wrapper = mount(HexView, { props: { bytes } })
    expect(wrapper.text()).toContain('00000000')
    expect(wrapper.text()).toContain('00000010')
  })

  it('marks output as truncated when bytes exceed maxRows', () => {
    const bytes = new Uint8Array(64)
    const wrapper = mount(HexView, { props: { bytes, maxRows: 1 } })
    expect(wrapper.text()).toContain('(truncated)')
  })
})
