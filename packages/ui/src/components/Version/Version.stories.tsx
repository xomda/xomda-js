import type { Meta, StoryObj } from '@storybook/vue3'
import { h, type VNode } from 'vue'

import { Version } from './Version'

const meta: Meta<typeof Version> = {
  component: Version,
  title: 'UI/Version',
  parameters: { layout: 'padded' },
  argTypes: {
    chip: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['x-small', 'small', 'default'] },
    color: {
      control: 'select',
      options: [undefined, 'primary', 'secondary', 'success', 'warning', 'error', 'info'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Version>

// ───── single-arg stories ──────────────────────────────────────────────

export const Inline: Story = {
  args: { version: '1.2.3' },
}

export const WithPrefix: Story = {
  args: { version: '1.2.3', prefix: 'v' },
}

export const Chip: Story = {
  args: { version: '1.2.3', prefix: 'v', chip: true },
}

export const Empty: Story = {
  args: { version: '' },
}

export const EmptyCustomPlaceholder: Story = {
  args: { version: '', placeholder: 'unreleased' },
}

// ───── links ───────────────────────────────────────────────────────────

export const LinkedHref: Story = {
  args: { version: '2.0.0', prefix: 'v', href: '#changelog' },
}

export const LinkedHrefChip: Story = {
  args: { version: '2.0.0', prefix: 'v', chip: true, href: '#changelog' },
}

// ───── color variants on chip mode ─────────────────────────────────────

export const ChipColors: Story = {
  // Render the chip in every Vuetify semantic color so the colour
  // mapping is obvious at a glance (stable → success, prerelease →
  // warning, etc. — convention only, the component doesn't enforce it).
  render: () => ({
    setup: () => () =>
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center' }, [
        h(Version, { version: '1.0.0', prefix: 'v', chip: true, color: 'success' }),
        h(Version, { version: '2.0.0-rc.1', prefix: 'v', chip: true, color: 'warning' }),
        h(Version, { version: '3.0.0-alpha.0', prefix: 'v', chip: true, color: 'error' }),
        h(Version, { version: '0.0.1', prefix: 'v', chip: true, color: 'info' }),
        h(Version, { version: '1.0.0', prefix: 'v', chip: true, color: 'primary' }),
        h(Version, { version: '1.0.0', prefix: 'v', chip: true, color: 'secondary' }),
        h(Version, { version: '1.0.0', prefix: 'v', chip: true }),
      ]),
  }),
}

// ───── the semver zoo ──────────────────────────────────────────────────

// Every semver / npm range form, side by side, so kerning + alignment
// of glyphs like `^`, `~`, `>=`, `||`, `-`, `+`, `.` is easy to eyeball.
// Each row keeps the same component (inline vs chip) for visual diff.
const semverSpecimens: Array<{ label: string; version: string }> = [
  { label: 'Exact', version: '1.2.3' },
  { label: 'Caret (compatible)', version: '^1.2.3' },
  { label: 'Tilde (approx.)', version: '~1.2.3' },
  { label: 'X-range (patch)', version: '1.2.x' },
  { label: 'X-range (minor)', version: '1.x' },
  { label: 'Star (anything)', version: '*' },
  { label: 'GTE', version: '>=1.0.0' },
  { label: 'LT', version: '<2.0.0' },
  { label: 'And-range', version: '>=1.0.0 <2.0.0' },
  { label: 'Or-range', version: '^1.0.0 || ^2.0.0' },
  { label: 'Hyphen range', version: '1.2.3 - 2.3.4' },
  { label: 'Numeric trailing +', version: '1.0+' },
  { label: 'Pinned major', version: '1' },
  { label: 'Prerelease (alpha)', version: '1.0.0-alpha.01' },
  { label: 'Prerelease (beta)', version: '2.0.0-beta.3' },
  { label: 'Prerelease (rc)', version: '3.0.0-rc.0' },
  { label: 'Build metadata', version: '1.0.0+20130313144700' },
  { label: 'Pre + build', version: '2.0.0-beta.3+sha.5e3b1d2' },
  { label: 'Calendar (CalVer)', version: '2026.05.16' },
  { label: 'Git tag-ish', version: 'git+ssh://git@github.com/x/y#semver:^1.0.0' },
  { label: 'Distant future', version: '999.999.999' },
  { label: 'Zero-dot-zero', version: '0.0.0' },
]

const Row = (label: string, body: VNode) =>
  h('div', { style: 'display:contents' }, [
    h('div', { style: 'color:rgba(127,127,127,0.9);font-size:12px;padding-right:16px' }, label),
    h('div', undefined, [body]),
  ])

export const SemverZooInline: Story = {
  name: 'Semver zoo · inline',
  render: () => ({
    setup: () => () =>
      h(
        'div',
        {
          style:
            'display:grid;grid-template-columns:max-content 1fr;row-gap:8px;align-items:center',
        },
        semverSpecimens.map((s) => Row(s.label, h(Version, { version: s.version })))
      ),
  }),
}

export const SemverZooChips: Story = {
  name: 'Semver zoo · chips',
  render: () => ({
    setup: () => () =>
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;gap:6px;max-width:720px' },
        semverSpecimens.map((s) => h(Version, { version: s.version, chip: true, size: 'small' }))
      ),
  }),
}

export const SemverZooLinkedChips: Story = {
  name: 'Semver zoo · linked chips',
  // Wire every chip to the same `#` anchor — proves the `href` wrap
  // and the underline-on-hover styling work for every range form.
  render: () => ({
    setup: () => () =>
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;gap:6px;max-width:720px' },
        semverSpecimens.map((s) =>
          h(Version, {
            version: s.version,
            chip: true,
            size: 'small',
            href: `#${encodeURIComponent(s.version)}`,
          })
        )
      ),
  }),
}

// ───── size sweep (chip) ───────────────────────────────────────────────

export const ChipSizes: Story = {
  render: () => ({
    setup: () => () =>
      h('div', { style: 'display:flex;align-items:center;gap:12px' }, [
        h(Version, { version: '1.2.3', prefix: 'v', chip: true, size: 'x-small' }),
        h(Version, { version: '1.2.3', prefix: 'v', chip: true, size: 'small' }),
        h(Version, { version: '1.2.3', prefix: 'v', chip: true, size: 'default' }),
      ]),
  }),
}

// ───── kerning torture test ────────────────────────────────────────────

// Stack monospace versions so tabular-nums alignment is obvious — each
// column of digits should line up perfectly.
export const KerningStack: Story = {
  render: () => ({
    setup: () => () =>
      h(
        'div',
        { style: 'display:flex;flex-direction:column;gap:2px' },
        [
          '0.0.1',
          '1.10.100',
          '10.0.0',
          '99.99.99',
          '100.10.1',
          '1.2.3-alpha.01',
          '2.3.4+build.555',
        ].map((v) => h(Version, { version: v }))
      ),
  }),
}
