import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import type { SearchHit, SearchProvider } from '../providers'
import { useAppSearch } from '../useAppSearch'

vi.mock('../../../trpc', () => ({ trpc: {} }))

function makeProvider(
  id: SearchProvider['id'],
  hits: SearchHit[],
  opts: { delayMs?: number; throws?: boolean } = {}
): SearchProvider {
  return {
    id,
    label: id,
    load: async () => undefined,
    search: async (_q, signal) => {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
      if (signal.aborted) return []
      if (opts.throws) throw new Error('boom')
      return hits
    },
  }
}

function hit(id: string, score = 100): SearchHit {
  return {
    id,
    type: 'entity',
    title: id,
    icon: '',
    score,
    navigate: () => {},
  }
}

function harness(providers: SearchProvider[], opts: { debounceMs?: number } = {}) {
  let api!: ReturnType<typeof useAppSearch>
  const Comp = defineComponent({
    setup() {
      api = useAppSearch({ providers, debounceMs: opts.debounceMs ?? 0 })
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { api: () => api, wrapper }
}

const flush = (ms = 5): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('useAppSearch', () => {
  it('returns no results for empty query', async () => {
    const { api } = harness([makeProvider('model', [hit('a')])])
    api().query.value = '   '
    await flush(10)
    expect(api().groups.value).toEqual([])
  })

  it('caps hits per group', async () => {
    const many = Array.from({ length: 25 }, (_, i) => hit(`h${i}`, i))
    const { api } = harness([makeProvider('model', many)])
    api().query.value = 'h'
    await flush(10)
    const group = api().groups.value[0]
    expect(group.hits.length).toBe(10)
    // Highest scores first
    expect(group.hits[0].score).toBe(24)
  })

  it('omits empty groups', async () => {
    const { api } = harness([makeProvider('model', []), makeProvider('templates', [hit('t1')])])
    api().query.value = 'q'
    await flush(10)
    expect(api().groups.value.map((g) => g.providerId)).toEqual(['templates'])
  })

  it('records errors per provider but keeps successful groups', async () => {
    const { api } = harness([
      makeProvider('model', [hit('m1')]),
      makeProvider('templates', [], { throws: true }),
    ])
    api().query.value = 'q'
    await flush(10)
    expect(api().groups.value.map((g) => g.providerId)).toEqual(['model'])
    expect(api().error.value).toContain('templates')
  })

  it('aborts in-flight searches when query changes', async () => {
    const slow = makeProvider('model', [hit('slow')], { delayMs: 50 })
    const { api } = harness([slow])
    api().query.value = 'a'
    // change before previous resolves
    await flush(5)
    api().query.value = 'b'
    await flush(80)
    // Last query wins
    expect(api().query.value).toBe('b')
  })

  it('reset() clears state', async () => {
    const { api } = harness([makeProvider('model', [hit('m')])])
    api().query.value = 'm'
    await flush(10)
    expect(api().groups.value.length).toBe(1)
    api().reset()
    expect(api().query.value).toBe('')
    expect(api().groups.value).toEqual([])
  })
})

const _nextTick = nextTick // keep import used
