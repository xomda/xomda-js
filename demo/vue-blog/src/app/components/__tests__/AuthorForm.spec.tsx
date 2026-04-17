import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { AuthorForm } from '../AuthorForm'

const fillAndSubmit = async (values: Partial<{ name: string; email: string; id: string }>) => {
  const wrapper = mount(AuthorForm)
  if (values.name !== undefined) {
    await wrapper.get('[data-testid="author-name"]').setValue(values.name)
  }
  if (values.email !== undefined) {
    await wrapper.get('[data-testid="author-email"]').setValue(values.email)
  }
  if (values.id !== undefined) {
    await wrapper.get('[data-testid="author-id"]').setValue(values.id)
  }
  await wrapper.get('form').trigger('submit')
  return wrapper
}

describe('AuthorForm (Vue SPA wired to xomda-generated AuthorSchema)', () => {
  it('emits "create" with a parsed Author when input is well-formed', async () => {
    const wrapper = await fillAndSubmit({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })

    const events = wrapper.emitted('create')
    expect(events, 'expected one create event').toHaveLength(1)
    const [author] = events![0] as [{ id: string; name: string; email: string }]
    expect(author.name).toBe('Ada Lovelace')
    expect(author.email).toBe('ada@example.com')
    expect(author.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(wrapper.find('[data-testid="author-errors"]').exists()).toBe(false)
  })

  it('blocks submit and surfaces issues when AuthorSchema.safeParse fails', async () => {
    const wrapper = await fillAndSubmit({
      name: 'Ada',
      email: 'ada@example.com',
      id: 'not-a-uuid',
    })

    expect(wrapper.emitted('create')).toBeUndefined()
    const errors = wrapper.get('[data-testid="author-errors"]')
    expect(errors.text()).toMatch(/id:/i)
  })

  it('resets the form after a successful submit', async () => {
    const wrapper = await fillAndSubmit({
      name: 'Grace Hopper',
      email: 'grace@example.com',
    })
    const name = wrapper.get('[data-testid="author-name"]').element as HTMLInputElement
    const email = wrapper.get('[data-testid="author-email"]').element as HTMLInputElement
    expect(name.value).toBe('')
    expect(email.value).toBe('')
  })
})
