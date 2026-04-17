import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateMock = vi.fn<(root: string, options?: { outputDir?: string }) => Promise<unknown[]>>()

vi.mock('@xomda/cli', () => ({
  generate: (...args: Parameters<typeof generateMock>) => generateMock(...args),
}))

// Static import after vi.mock so the mock is in place before the module evaluates.
import { XomdaPlugin, type XomdaPluginOptions } from '../index'

type RollupPluginShape = {
  name: string
  buildStart?: (this: unknown) => unknown
  watchChange?: (this: unknown, id: string) => unknown
}

function makeRollupPlugin(options?: XomdaPluginOptions): RollupPluginShape {
  // `unplugin` exposes per-bundler factories; `.rollup(opts)` returns a Rollup plugin object.
  return XomdaPlugin.rollup(options) as unknown as RollupPluginShape
}

describe('XomdaPlugin', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    generateMock.mockReset()
    generateMock.mockResolvedValue([])
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('exposes per-bundler factories', () => {
    expect(typeof XomdaPlugin.rollup).toBe('function')
    expect(typeof XomdaPlugin.vite).toBe('function')
    expect(typeof XomdaPlugin.webpack).toBe('function')
    expect(typeof XomdaPlugin.esbuild).toBe('function')
  })

  it('the produced plugin has the expected name and hook surface', () => {
    const plugin = makeRollupPlugin()
    expect(plugin.name).toBe('xomda')
    expect(typeof plugin.buildStart).toBe('function')
    expect(typeof plugin.watchChange).toBe('function')
  })

  it('buildStart calls generate with the configured root and output', async () => {
    const plugin = makeRollupPlugin({ root: '/proj', output: 'gen' })
    await plugin.buildStart!.call({})
    expect(generateMock).toHaveBeenCalledExactlyOnceWith('/proj', { outputDir: 'gen' })
  })

  it('buildStart defaults root to process.cwd() when not provided', async () => {
    const plugin = makeRollupPlugin()
    await plugin.buildStart!.call({})
    expect(generateMock).toHaveBeenCalledExactlyOnceWith(process.cwd(), { outputDir: undefined })
  })

  it("buildStart is a no-op when mode is 'serve'", async () => {
    const plugin = makeRollupPlugin({ mode: 'serve' })
    await plugin.buildStart!.call({})
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("buildStart runs when mode is 'always'", async () => {
    const plugin = makeRollupPlugin({ mode: 'always' })
    await plugin.buildStart!.call({})
    expect(generateMock).toHaveBeenCalledTimes(1)
  })

  it('watchChange triggers generate for paths under .xomda', async () => {
    const plugin = makeRollupPlugin({ mode: 'serve' })
    plugin.watchChange!.call({}, '/proj/.xomda/model.json')
    await vi.waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
  })

  it('watchChange triggers generate for .template.json files', async () => {
    const plugin = makeRollupPlugin({ mode: 'serve' })
    plugin.watchChange!.call({}, '/proj/templates/foo.template.json')
    await vi.waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
  })

  it('watchChange ignores unrelated file changes', async () => {
    const plugin = makeRollupPlugin({ mode: 'serve' })
    plugin.watchChange!.call({}, '/proj/src/main.ts')
    // Give the void-promise a tick to settle if it were going to fire.
    await new Promise((r) => setTimeout(r, 5))
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("watchChange is a no-op when mode is 'build'", async () => {
    const plugin = makeRollupPlugin({ mode: 'build' })
    plugin.watchChange!.call({}, '/proj/.xomda/model.json')
    await new Promise((r) => setTimeout(r, 5))
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("watchChange runs when mode is 'always'", async () => {
    const plugin = makeRollupPlugin({ mode: 'always' })
    plugin.watchChange!.call({}, '/proj/.xomda/model.json')
    await vi.waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
  })

  it('logs a summary line when generate writes files', async () => {
    generateMock.mockResolvedValueOnce([{}, {}, {}])
    const plugin = makeRollupPlugin()
    await plugin.buildStart!.call({})
    expect(logSpy).toHaveBeenCalledWith('[xomda] Generated 3 file(s)')
  })

  it('does not log when generate writes zero files', async () => {
    generateMock.mockResolvedValueOnce([])
    const plugin = makeRollupPlugin()
    await plugin.buildStart!.call({})
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('reports errors via console.error without throwing', async () => {
    generateMock.mockRejectedValueOnce(new Error('boom'))
    const plugin = makeRollupPlugin()
    await expect(plugin.buildStart!.call({})).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith('[xomda] Generation failed:', 'boom')
  })
})
