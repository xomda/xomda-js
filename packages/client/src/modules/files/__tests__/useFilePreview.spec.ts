import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import type { FileStats, PreviewMap } from '../types'
import { type PreviewHintResult, useFilePreview } from '../useFilePreview'

const stats = (path: string): FileStats => ({
  name: path.split('/').pop()!,
  path,
  isDirectory: false,
  size: 1,
  mtime: '',
  atime: '',
  ctime: '',
  birthtime: '',
  isReadOnly: false,
  mode: 0o644,
})

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const noBytes = async () => ({ base64: '', size: 0, truncated: false })
const noHint = async (): Promise<PreviewHintResult> => ({})

describe('useFilePreview', () => {
  it('loads a text file and routes through the resolved language hint', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const preview = useFilePreview({
      previewMap,
      getStats: async (p) => stats(p),
      readFile: async () => ({ content: 'hello' }),
      readBytes: noBytes,
      fileTypesFor: async () => ({ preview: { kind: 'text', language: 'typescript' } }),
    })

    await preview.loadFileByPath('a.ts', false)

    expect(preview.previewTitle.value).toBe('a.ts')
    expect(preview.preview.value.kind).toBe('text')
    expect(preview.preview.value.text).toBe('hello')
    expect(preview.preview.value.language).toBe('typescript')
    expect(preview.selectedFile.value?.path).toBe('a.ts')
    expect(preview.showInfo.value).toBe(true)
  })

  it('falls back to languageFromPath when no hint is provided', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const preview = useFilePreview({
      previewMap,
      getStats: async (p) => stats(p),
      readFile: async () => ({ content: 'x' }),
      readBytes: noBytes,
      fileTypesFor: noHint,
    })

    await preview.loadFileByPath('a.ts', false)
    expect(preview.preview.value.language).toBe('typescript')
  })

  it('renders a binary preview when the hint is binary', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const preview = useFilePreview({
      previewMap,
      getStats: async (p) => stats(p),
      readFile: async () => {
        throw new Error('should not be called for binary')
      },
      readBytes: async () => ({ base64: 'YWJj', size: 3, truncated: false }),
      fileTypesFor: async () => ({ preview: { kind: 'binary' } }),
    })

    await preview.loadFileByPath('a.bin', false)
    expect(preview.preview.value.kind).toBe('binary')
    expect(preview.preview.value.base64).toBe('YWJj')
    expect(preview.preview.value.size).toBe(3)
  })

  it('renders an image preview when the hint is image', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const preview = useFilePreview({
      previewMap,
      getStats: async (p) => stats(p),
      readFile: async () => {
        throw new Error('should not be called for image')
      },
      readBytes: async () => ({ base64: 'aW1n', size: 3, truncated: false }),
      fileTypesFor: async () => ({ preview: { kind: 'image' } }),
    })

    await preview.loadFileByPath('a.png', false)
    expect(preview.preview.value.kind).toBe('image')
    expect(preview.preview.value.base64).toBe('aW1n')
  })

  it('reads virtual (generated) files synchronously from the preview map', async () => {
    const previewMap = ref<PreviewMap>(new Map([['gen/x.ts', 'virtual']]))
    const preview = useFilePreview({
      previewMap,
      getStats: async () => {
        throw new Error('should not be called')
      },
      readFile: async () => {
        throw new Error('should not be called')
      },
      readBytes: noBytes,
      fileTypesFor: noHint,
    })

    await preview.loadFileByPath('gen/x.ts', true)

    expect(preview.previewTitle.value).toBe('gen/x.ts')
    expect(preview.preview.value.kind).toBe('text')
    expect(preview.preview.value.text).toBe('virtual')
    expect(preview.selectedFile.value).toBeNull()
  })

  it('preserves the user-controlled showInfo state across file loads', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const preview = useFilePreview({
      previewMap,
      getStats: async (p) => stats(p),
      readFile: async () => ({ content: 'x' }),
      readBytes: noBytes,
      fileTypesFor: noHint,
    })

    expect(preview.showInfo.value).toBe(true)

    preview.closeInfo()
    expect(preview.showInfo.value).toBe(false)

    await preview.loadFileByPath('a.ts', false)
    expect(preview.showInfo.value).toBe(false)

    preview.openInfo()
    expect(preview.showInfo.value).toBe(true)
  })

  it('ignores a stale response when a newer load has started', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const aStats = deferred<FileStats>()
    const aRead = deferred<{ content: string }>()
    const bStats = deferred<FileStats>()
    const bRead = deferred<{ content: string }>()

    const preview = useFilePreview({
      previewMap,
      getStats: (p) => (p === 'a.ts' ? aStats.promise : bStats.promise),
      readFile: (p) => (p === 'a.ts' ? aRead.promise : bRead.promise),
      readBytes: noBytes,
      fileTypesFor: noHint,
    })

    const loadA = preview.loadFileByPath('a.ts', false)
    const loadB = preview.loadFileByPath('b.ts', false)

    bStats.resolve(stats('b.ts'))
    bRead.resolve({ content: 'B-content' })
    await loadB

    expect(preview.previewTitle.value).toBe('b.ts')
    expect(preview.preview.value.text).toBe('B-content')

    aStats.resolve(stats('a.ts'))
    aRead.resolve({ content: 'A-content' })
    await loadA

    expect(preview.previewTitle.value).toBe('b.ts')
    expect(preview.preview.value.text).toBe('B-content')
  })

  it('clearPreview invalidates any in-flight load', async () => {
    const previewMap = ref<PreviewMap>(new Map())
    const aStats = deferred<FileStats>()
    const aRead = deferred<{ content: string }>()
    const preview = useFilePreview({
      previewMap,
      getStats: () => aStats.promise,
      readFile: () => aRead.promise,
      readBytes: noBytes,
      fileTypesFor: noHint,
    })

    const loadA = preview.loadFileByPath('a.ts', false)
    preview.clearPreview()

    aStats.resolve(stats('a.ts'))
    aRead.resolve({ content: 'A-content' })
    await loadA

    expect(preview.previewTitle.value).toBe('')
    expect(preview.preview.value.kind).toBe('none')
    expect(preview.selectedFile.value).toBeNull()
  })
})
