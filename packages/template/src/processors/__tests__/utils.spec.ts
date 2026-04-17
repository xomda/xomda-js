import { afterEach, describe, expect, it } from 'vitest'

import {
  __clearTemplateFnCacheForTests,
  CapturedConsole,
  createTemplateFn,
  OutputBuffer,
} from '../utils'

describe('OutputBuffer', () => {
  it('concatenates writes in insertion order', () => {
    const buf = new OutputBuffer()
    buf.write('hello ')
    buf.write('world')
    expect(buf.getContent()).toBe('hello world')
    expect(buf.toString()).toBe('hello world')
  })
})

describe('CapturedConsole', () => {
  it('captures log / warn / error / info', () => {
    const c = new CapturedConsole()
    c.log('a', 1)
    c.warn('b')
    c.error('c')
    c.info('d')
    expect(c.logs).toEqual(['a 1', '[warn] b', '[error] c', '[info] d'])
  })
})

describe('createTemplateFn', () => {
  afterEach(() => __clearTemplateFnCacheForTests())

  it('returns the value computed by the body', () => {
    const fn = createTemplateFn(['x', 'y'], 'return x + y')
    expect(fn(2, 3)).toBe(5)
  })

  it('shadows browser/DOM globals so they are undefined inside the body', () => {
    const fn = createTemplateFn([], 'return typeof window')
    expect(fn()).toBe('undefined')
  })

  it('lets a param name punch through the shadow list', () => {
    // If the caller declares `fetch` as a param, it must NOT be blocked.
    const fn = createTemplateFn(['fetch'], 'return fetch')
    const sentinel = { ok: true }
    expect(fn(sentinel)).toBe(sentinel)
  })

  it('memoizes by (paramNames, body, strict) so repeat compilation is cheap', () => {
    const a = createTemplateFn(['x'], 'return x * 2')
    const b = createTemplateFn(['x'], 'return x * 2')
    expect(a).toBe(b)
  })

  it('does NOT collide across different bodies', () => {
    const a = createTemplateFn(['x'], 'return x * 2')
    const b = createTemplateFn(['x'], 'return x * 3')
    expect(a).not.toBe(b)
    expect(a(2)).toBe(4)
    expect(b(2)).toBe(6)
  })

  it('does NOT collide across different param orders', () => {
    const a = createTemplateFn(['x', 'y'], 'return x - y')
    const b = createTemplateFn(['y', 'x'], 'return x - y')
    expect(a).not.toBe(b)
    expect(a(10, 3)).toBe(7)
    expect(b(10, 3)).toBe(-7)
  })

  it('does NOT collide across strict-mode variants', () => {
    const strict = createTemplateFn([], 'return 1', { strict: true })
    const sloppy = createTemplateFn([], 'return 1', { strict: false })
    expect(strict).not.toBe(sloppy)
  })

  it('runs in strict mode by default (assignment to undeclared var throws)', () => {
    const fn = createTemplateFn([], 'undeclared = 1; return undeclared')
    expect(() => fn()).toThrow()
  })
})
