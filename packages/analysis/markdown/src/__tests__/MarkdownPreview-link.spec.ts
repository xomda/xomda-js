import { describe, expect, it, vi } from 'vitest'

import { handleLocalLinkClick } from '../link-handler'

interface FakeEventOptions {
  defaultPrevented?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  button?: number
}

const fakeEvent = (opts: FakeEventOptions = {}) => {
  const preventDefault = vi.fn()
  return {
    event: {
      defaultPrevented: opts.defaultPrevented ?? false,
      metaKey: opts.metaKey ?? false,
      ctrlKey: opts.ctrlKey ?? false,
      shiftKey: opts.shiftKey ?? false,
      altKey: opts.altKey ?? false,
      button: opts.button ?? 0,
      preventDefault,
    } as unknown as MouseEvent,
    preventDefault,
  }
}

describe('handleLocalLinkClick', () => {
  it('prevents default and calls the host callback for a plain primary click', () => {
    const open = vi.fn(() => true)
    const { event, preventDefault } = fakeEvent()
    handleLocalLinkClick(event, './other.md', 'docs/a.md', open)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('./other.md', 'docs/a.md')
  })

  it('does nothing for a no-op host (open === null) but still swallows the click', () => {
    const { event, preventDefault } = fakeEvent()
    expect(() => handleLocalLinkClick(event, './other.md', 'docs/a.md', null)).not.toThrow()
    expect(preventDefault).toHaveBeenCalled()
  })

  it.each([
    ['meta', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
  ])('lets a %s-modified click through unhandled (new tab / save link)', (_, mods) => {
    const open = vi.fn()
    const { event, preventDefault } = fakeEvent(mods)
    handleLocalLinkClick(event, './other.md', 'docs/a.md', open)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('lets middle-click through (button !== 0)', () => {
    const open = vi.fn()
    const { event, preventDefault } = fakeEvent({ button: 1 })
    handleLocalLinkClick(event, './other.md', 'docs/a.md', open)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('bails when a previous handler already prevented default', () => {
    const open = vi.fn()
    const { event, preventDefault } = fakeEvent({ defaultPrevented: true })
    handleLocalLinkClick(event, './other.md', 'docs/a.md', open)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})
