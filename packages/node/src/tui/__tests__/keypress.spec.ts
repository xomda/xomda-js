import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startKeypressHandler } from '../keypress'

// Patch stdin to look like a TTY for these tests. `setRawMode` only exists on
// real TTY streams; in CI it's missing, so we add stubs before each test.
const installFakeTTY = (): { restore: () => void } => {
  const stdin = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (m: boolean) => unknown
  }
  const hadTty = stdin.isTTY
  const hadSetRaw = stdin.setRawMode
  Object.defineProperty(stdin, 'isTTY', { configurable: true, value: true })
  if (!hadSetRaw) {
    stdin.setRawMode = () => stdin
  }
  return {
    restore: () => {
      Object.defineProperty(stdin, 'isTTY', { configurable: true, value: hadTty })
      if (!hadSetRaw) {
        // Re-narrow so `delete` is type-safe: only delete what we installed.
        ;(stdin as { setRawMode?: (m: boolean) => unknown }).setRawMode = undefined
      }
    },
  }
}

describe('startKeypressHandler', () => {
  let cleanup: { restore: () => void } | null = null

  beforeEach(() => {
    cleanup = null
  })

  afterEach(() => {
    cleanup?.restore()
    cleanup = null
    vi.restoreAllMocks()
  })

  it('returns a noop cleanup when stdin is not a TTY', () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false })
    const stop = startKeypressHandler()
    expect(typeof stop).toBe('function')
    expect(() => stop()).not.toThrow()
  })

  it('subscribes to stdin and unsubscribes on stop when TTY', () => {
    cleanup = installFakeTTY()
    const setRawMode = vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()

    const initialListeners = process.stdin.listenerCount('data')
    const stop = startKeypressHandler()
    expect(process.stdin.listenerCount('data')).toBe(initialListeners + 1)
    expect(setRawMode).toHaveBeenCalledWith(true)

    stop()
    expect(process.stdin.listenerCount('data')).toBe(initialListeners)
    expect(setRawMode).toHaveBeenCalledWith(false)
  })

  it('invokes a matching custom command action', () => {
    cleanup = installFakeTTY()
    vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()

    const action = vi.fn()
    const stop = startKeypressHandler({
      commands: [{ key: 't', description: 'test', action }],
    })
    process.stdin.emit('data', 't')
    expect(action).toHaveBeenCalledOnce()

    stop()
  })

  it('matches case-insensitively', () => {
    cleanup = installFakeTTY()
    vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()

    const action = vi.fn()
    const stop = startKeypressHandler({
      commands: [{ key: 'x', description: 'test', action }],
    })
    process.stdin.emit('data', 'X')
    expect(action).toHaveBeenCalledOnce()

    stop()
  })

  it('exits the process on Ctrl-C / Ctrl-D', () => {
    cleanup = installFakeTTY()
    vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const stop = startKeypressHandler()
    process.stdin.emit('data', '\x03')
    expect(exit).toHaveBeenCalledWith(0)
    process.stdin.emit('data', '\x04')
    expect(exit).toHaveBeenCalledTimes(2)

    stop()
  })

  it('ignores keys that do not match any registered command', () => {
    cleanup = installFakeTTY()
    vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const customAction = vi.fn()

    const stop = startKeypressHandler({
      commands: [{ key: 'a', description: 'a', action: customAction }],
    })
    process.stdin.emit('data', 'z')
    expect(customAction).not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()

    stop()
  })

  it('exposes the built-in commands (o/h/c/q) — pressing q exits', () => {
    cleanup = installFakeTTY()
    vi.spyOn(process.stdin, 'setRawMode').mockReturnThis()
    vi.spyOn(process.stdin, 'resume').mockReturnThis()
    vi.spyOn(process.stdin, 'pause').mockReturnThis()
    vi.spyOn(process.stdin, 'setEncoding').mockReturnThis()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true as never)
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

    const stop = startKeypressHandler({ primaryUrl: () => undefined })
    process.stdin.emit('data', 'h') // help
    process.stdin.emit('data', 'c') // clear screen
    process.stdin.emit('data', 'o') // open URL — none configured
    process.stdin.emit('data', 'q') // quit
    expect(exit).toHaveBeenCalledWith(0)

    stop()
  })
})
