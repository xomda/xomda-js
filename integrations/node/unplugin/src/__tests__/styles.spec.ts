import { describe, expect, it } from 'vitest'

import { xomdaStylesPlugin } from '../styles'

const PACKAGES = {
  '@xomda/ui': '/abs/path/to/packages/ui/src',
  '@xomda/icons': '/abs/path/to/packages/icons/src',
} as const

function makePlugin() {
  return xomdaStylesPlugin({ packages: PACKAGES })
}

// Vite plugin hooks have a `this` ThisParameterType signature; call as plain functions.
type ResolveId = (source: string, importer?: string) => string | undefined
type Load = (id: string) => string | undefined

describe('xomdaStylesPlugin', () => {
  it('uses the expected name and metadata', () => {
    const plugin = makePlugin()
    expect(plugin.name).toBe('xomda:workspace-styles')
    expect(plugin.apply).toBeUndefined()
    expect(plugin.enforce).toBe('pre')
  })

  it('redirects the bare specifier `<pkg>/style.css` to the stub id', () => {
    const plugin = makePlugin()
    const resolveId = plugin.resolveId as unknown as ResolveId
    const resolved = resolveId('@xomda/ui/style.css')
    expect(resolved).toBe('\0xomda:empty-styles.css')
  })

  it('redirects the post-alias absolute path `<srcDir>/style.css` to the stub id', () => {
    const plugin = makePlugin()
    const resolveId = plugin.resolveId as unknown as ResolveId
    const resolved = resolveId('/abs/path/to/packages/ui/src/style.css')
    expect(resolved).toBe('\0xomda:empty-styles.css')
  })

  it('redirects style.css for every registered package', () => {
    const plugin = makePlugin()
    const resolveId = plugin.resolveId as unknown as ResolveId
    expect(resolveId('@xomda/icons/style.css')).toBe('\0xomda:empty-styles.css')
    expect(resolveId('/abs/path/to/packages/icons/src/style.css')).toBe('\0xomda:empty-styles.css')
  })

  it('does not intercept unrelated paths', () => {
    const plugin = makePlugin()
    const resolveId = plugin.resolveId as unknown as ResolveId
    expect(resolveId('@xomda/ui/index.ts')).toBeUndefined()
    expect(resolveId('/abs/path/to/packages/ui/src/main.ts')).toBeUndefined()
    expect(resolveId('vue')).toBeUndefined()
    expect(resolveId('@xomda/other/style.css')).toBeUndefined()
  })

  it('loads the stub id as an empty CSS string', () => {
    const plugin = makePlugin()
    const load = plugin.load as unknown as Load
    expect(load('\0xomda:empty-styles.css')).toBe('')
    expect(load('something-else')).toBeUndefined()
  })

  it('supports zero packages', () => {
    const plugin = xomdaStylesPlugin({ packages: {} })
    const resolveId = plugin.resolveId as unknown as ResolveId
    expect(resolveId('@xomda/ui/style.css')).toBeUndefined()
  })
})
