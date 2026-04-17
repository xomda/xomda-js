import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'

import { Version } from '../Version'

const vuetify = createVuetify()
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:rest(.*)*', component: { template: '<div/>' } }],
})

const globalOpts = { global: { plugins: [vuetify, router] } }

const mountIt = (props: Record<string, unknown>) =>
  mount(Version, { props: props as never, ...globalOpts })

describe('Version', () => {
  // ─── basic rendering ────────────────────────────────────────────────
  it('renders the version string with optional prefix', () => {
    const w = mountIt({ version: '1.2.3', prefix: 'v' })
    expect(w.text()).toBe('v1.2.3')
  })

  it('renders without a prefix by default', () => {
    expect(mountIt({ version: '1.2.3' }).text()).toBe('1.2.3')
  })

  it('falls back to the placeholder when version is empty', () => {
    expect(mountIt({ version: '', placeholder: 'unset' }).text()).toBe('unset')
  })

  it('default placeholder is an em-dash when none is given', () => {
    expect(mountIt({ version: '' }).text()).toBe('—')
  })

  it('placeholder is shown even when a prefix is set', () => {
    // Prefix must not leak into the placeholder — the empty branch
    // ignores `prefix` entirely.
    expect(mountIt({ version: '', prefix: 'v' }).text()).toBe('—')
  })

  // ─── semver / npm range zoo ─────────────────────────────────────────
  // Every range form must round-trip through Version unmodified — the
  // component is presentation-only, so its job is "don't touch the
  // string." If any of these starts producing a transformed/escaped
  // output, that's a regression.
  const semverSpecimens: Array<[label: string, version: string]> = [
    ['exact', '1.2.3'],
    ['caret', '^1.2.3'],
    ['tilde', '~1.2.3'],
    ['x-range patch', '1.2.x'],
    ['x-range minor', '1.x'],
    ['star', '*'],
    ['gte', '>=1.0.0'],
    ['lt', '<2.0.0'],
    ['and-range', '>=1.0.0 <2.0.0'],
    ['or-range', '^1.0.0 || ^2.0.0'],
    ['hyphen range', '1.2.3 - 2.3.4'],
    ['numeric trailing +', '1.0+'],
    ['pinned major', '1'],
    ['prerelease alpha (leading zero)', '1.0.0-alpha.01'],
    ['prerelease beta', '2.0.0-beta.3'],
    ['prerelease rc', '3.0.0-rc.0'],
    ['build metadata', '1.0.0+20130313144700'],
    ['prerelease + build', '2.0.0-beta.3+sha.5e3b1d2'],
    ['calver', '2026.05.16'],
    ['git url with semver ref', 'git+ssh://git@github.com/x/y#semver:^1.0.0'],
    ['very large major', '999.999.999'],
    ['zero version', '0.0.0'],
    ['single digit only', '1'],
    ['unicode-ish prerelease', '1.0.0-α.β'],
  ]

  // Whitespace handling is its own assertion — `.text()` collapses
  // surrounding whitespace, so we read raw `textContent` to verify the
  // string is rendered as-given.
  it('preserves leading/trailing whitespace in the version string', () => {
    const padded = '  ^1.0.0  '
    const w = mountIt({ version: padded })
    expect(w.element.textContent).toBe(padded)
  })

  for (const [label, version] of semverSpecimens) {
    it(`renders ${label}: "${version}" verbatim (inline)`, () => {
      expect(mountIt({ version }).text()).toBe(version)
    })

    it(`renders ${label}: "${version}" verbatim (chip)`, () => {
      const w = mountIt({ version, chip: true })
      expect(w.find('.v-chip').exists()).toBe(true)
      expect(w.text()).toBe(version)
    })

    it(`renders ${label}: "${version}" verbatim with prefix`, () => {
      expect(mountIt({ version, prefix: 'v' }).text()).toBe(`v${version}`)
    })
  }

  // ─── prefix corner cases ────────────────────────────────────────────
  it('multi-character prefix is concatenated as-is', () => {
    expect(mountIt({ version: '1.2.3', prefix: 'release/' }).text()).toBe('release/1.2.3')
  })

  it('empty-string prefix is a no-op', () => {
    expect(mountIt({ version: '1.2.3', prefix: '' }).text()).toBe('1.2.3')
  })

  it('prefix containing whitespace is preserved', () => {
    expect(mountIt({ version: '1.2.3', prefix: 'v ' }).text()).toBe('v 1.2.3')
  })

  it('non-ascii prefix renders correctly', () => {
    expect(mountIt({ version: '1.2.3', prefix: '⛵ ' }).text()).toBe('⛵ 1.2.3')
  })

  // ─── chip mode ──────────────────────────────────────────────────────
  it('renders as a VChip when chip is true', () => {
    const w = mountIt({ version: '1.0.0', chip: true })
    expect(w.find('.v-chip').exists()).toBe(true)
    expect(w.text()).toContain('1.0.0')
  })

  it('does NOT render a VChip in default (inline) mode', () => {
    const w = mountIt({ version: '1.0.0' })
    expect(w.find('.v-chip').exists()).toBe(false)
  })

  it('chip mode honors `size`', () => {
    const w = mountIt({ version: '1.0.0', chip: true, size: 'x-small' })
    // Vuetify writes the size variant as a class on the chip root.
    expect(w.find('.v-chip').classes()).toContain('v-chip--size-x-small')
  })

  it('chip mode honors `color`', () => {
    const w = mountIt({ version: '1.0.0', chip: true, color: 'primary' })
    // Tonal chip with a named color gets the `text-primary` color class.
    const chip = w.find('.v-chip')
    expect(chip.exists()).toBe(true)
    expect(chip.classes().join(' ')).toMatch(/primary/)
  })

  it('chip + empty version still shows the placeholder', () => {
    const w = mountIt({ version: '', chip: true, placeholder: 'tbd' })
    expect(w.find('.v-chip').exists()).toBe(true)
    expect(w.text()).toBe('tbd')
  })

  // ─── navigation: `to` wins over `href` ─────────────────────────────
  it('wraps in a RouterLink when `to` is given', () => {
    const w = mountIt({ version: '1.0.0', to: '/versions' })
    const a = w.find('a')
    expect(a.exists()).toBe(true)
    expect(a.attributes('href')).toBe('/versions')
  })

  it('wraps in an anchor when `href` is given and `to` is not', () => {
    const w = mountIt({ version: '1.0.0', href: 'https://example.test/v/1.0.0' })
    const a = w.find('a')
    expect(a.exists()).toBe(true)
    expect(a.attributes('href')).toBe('https://example.test/v/1.0.0')
  })

  it('renders without an anchor when neither `to` nor `href` is given', () => {
    const w = mountIt({ version: '1.0.0' })
    expect(w.find('a').exists()).toBe(false)
  })

  it('`to` takes precedence over `href` when both are passed', () => {
    const w = mountIt({
      version: '1.0.0',
      to: '/router-target',
      href: 'https://example.test/anchor-target',
    })
    const a = w.find('a')
    expect(a.exists()).toBe(true)
    // RouterLink wins; href should be the router-resolved one.
    expect(a.attributes('href')).toBe('/router-target')
  })

  it('chip + `to` wraps the chip inside a RouterLink', () => {
    const w = mountIt({ version: '1.0.0', chip: true, to: '/v/1' })
    const a = w.find('a')
    expect(a.exists()).toBe(true)
    expect(a.find('.v-chip').exists()).toBe(true)
    expect(a.attributes('href')).toBe('/v/1')
  })

  it('chip + `href` wraps the chip inside a plain anchor', () => {
    const w = mountIt({
      version: '1.0.0',
      chip: true,
      href: 'https://example.test/v/1.0.0',
    })
    const a = w.find('a')
    expect(a.exists()).toBe(true)
    expect(a.find('.v-chip').exists()).toBe(true)
    expect(a.attributes('href')).toBe('https://example.test/v/1.0.0')
  })

  // ─── XSS / safety ───────────────────────────────────────────────────
  it('treats HTML-looking input as text (no injection)', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const w = mountIt({ version: evil })
    // The literal string is rendered; no `<img>` ends up in the DOM.
    expect(w.text()).toBe(evil)
    expect(w.element.querySelector('img')).toBeNull()
  })

  it('treats javascript: prefix in version as plain text', () => {
    const evil = 'javascript:alert(1)'
    const w = mountIt({ version: evil })
    expect(w.text()).toBe(evil)
  })

  // ─── monospace styling: regression guard ────────────────────────────
  it('inline mode applies the monospace `version` class', () => {
    const w = mountIt({ version: '1.0.0' })
    // The CSS module hashes the class name; assert presence of the
    // raw token regardless of hash so a refactor that renames the
    // class is caught here, not only in visual regressions.
    expect(w.html()).toMatch(/class="[^"]*version[^"]*"/)
  })

  it('chip mode applies the monospace `chip` class on the chip', () => {
    const w = mountIt({ version: '1.0.0', chip: true })
    expect(w.html()).toMatch(/class="[^"]*chip[^"]*"/)
  })
})
