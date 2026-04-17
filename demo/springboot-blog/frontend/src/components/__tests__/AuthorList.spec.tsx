import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Author } from '../../generated/Author'
import { AuthorList } from '../AuthorList'

// Proves: the xomda-generated `Author` type compiles against the component's
// prop contract, the component renders one row per author, and the optional
// `bio` field is treated as optional (no crash when omitted).
//
// No backend is started — the test injects a synchronous mock for
// `fetchAuthors`. The shared type contract is the only coupling between
// halves of the demo, which is the point.

const ada: Author = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  bio: 'Mathematician',
}
const grace: Author = {
  id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  name: 'Grace Hopper',
  email: 'grace@example.com',
}

describe('AuthorList', () => {
  it('renders one row per author returned by the fetch source', async () => {
    const wrapper = mount(AuthorList, {
      props: { fetchAuthors: () => Promise.resolve([ada, grace]) },
    })
    // wait for onMounted promise chain to flush
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('[data-testid="author-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Ada Lovelace')
    expect(rows[0].text()).toContain('ada@example.com')
    expect(rows[0].text()).toContain('Mathematician')
    // Grace has no bio — must still render without crashing.
    expect(rows[1].text()).toContain('Grace Hopper')
    expect(rows[1].text()).not.toContain('Mathematician')
  })

  it('surfaces fetch errors via an [role=alert] block', async () => {
    const wrapper = mount(AuthorList, {
      props: {
        fetchAuthors: () => Promise.reject(new Error('GET /api/authors failed: 503')),
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const err = wrapper.find('[data-testid="error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('503')
  })
})
