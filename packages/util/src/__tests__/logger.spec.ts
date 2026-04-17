import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearLogs, createLogger, getRecentLogs, type LogEntry, setLogSink } from '../logger'

afterEach(() => {
  clearLogs()
  setLogSink(undefined)
  vi.restoreAllMocks()
})

describe('logger', () => {
  it('records entries with level, source, message', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const log = createLogger('test')
    log.info('hello')
    const entries = getRecentLogs()
    expect(entries.at(-1)).toMatchObject({ level: 'info', source: 'test', message: 'hello' })
  })

  it('forwards to console matching the level', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = createLogger('test')
    log.error('boom')
    log.warn('soft')
    expect(errSpy).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('child() composes source paths', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const log = createLogger('model').child('selection')
    log.info('hi')
    expect(getRecentLogs().at(-1)?.source).toBe('model.selection')
  })

  it('sink receives entries flagged for attention', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const seen: LogEntry[] = []
    setLogSink((e) => seen.push(e))
    const log = createLogger('test')
    log.info('quiet')
    log.warn('look here', { attention: true })
    expect(seen).toHaveLength(2)
    expect(seen[1].attention).toBe(true)
  })

  it('caps the ring buffer', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const log = createLogger('flood')
    for (let i = 0; i < 1100; i++) log.info(`msg ${i}`)
    const entries = getRecentLogs()
    expect(entries.length).toBeLessThanOrEqual(1000)
    expect(entries.at(-1)?.message).toBe('msg 1099')
  })
})
