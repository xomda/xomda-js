import type { Meta, StoryObj } from '@storybook/vue3'

import { HexView } from './HexView'

const meta: Meta<typeof HexView> = {
  component: HexView,
  title: 'UI/HexView',
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof HexView>

function asciiBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff
  return arr
}

function binaryHeader(): Uint8Array {
  // PNG file signature + a few IHDR bytes — exercises both hex and ASCII columns.
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x08, 0x06, 0x00, 0x00, 0x00, 0x5c, 0x72, 0xa8,
  ])
}

export const Default: Story = {
  render: () => ({
    setup: () => () => <HexView bytes={binaryHeader()} />,
  }),
}

export const PlainText: Story = {
  render: () => ({
    setup: () => () => <HexView bytes={asciiBytes('hello, xomda! 1234567890 ABCDEF')} />,
  }),
}

export const Truncated: Story = {
  render: () => ({
    setup: () => () => <HexView bytes={new Uint8Array(4096).fill(0xab)} maxRows={4} />,
  }),
}

export const Empty: Story = {
  render: () => ({
    setup: () => () => <HexView bytes={new Uint8Array(0)} />,
  }),
}
