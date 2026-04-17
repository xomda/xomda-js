import { AuthorSchema } from '@generated/AuthorSchema'
import { defineComponent, reactive, ref } from 'vue'

import type { Author } from '../types'

interface AuthorDraft {
  id: string
  name: string
  email: string
}

const emptyDraft = (): AuthorDraft => ({
  id: crypto.randomUUID(),
  name: '',
  email: '',
})

/**
 * Hand-written Vue form whose validation is driven by the xomda-generated
 * AuthorSchema. Changing the model (`src/generate.ts`) and re-running
 * `pnpm generate` reshapes the validation — the form has to keep up or
 * `safeParse()` will start rejecting submissions.
 */
export const AuthorForm = defineComponent({
  name: 'AuthorForm',
  emits: ['create'],
  setup(_, { emit }) {
    const draft = reactive<AuthorDraft>(emptyDraft())
    const errors = ref<string[]>([])
    const submitted = ref(false)

    const submit = (event: Event) => {
      event.preventDefault()
      submitted.value = true
      const parsed = AuthorSchema.safeParse({ ...draft })
      if (!parsed.success) {
        errors.value = parsed.error.issues.map(
          (i) => `${i.path.join('.') || '(root)'}: ${i.message}`
        )
        return
      }
      errors.value = []
      emit('create', parsed.data as Author)
      Object.assign(draft, emptyDraft())
      submitted.value = false
    }

    return () => (
      <form onSubmit={submit} data-testid="author-form" novalidate>
        <label>
          Name
          <input type="text" v-model={draft.name} data-testid="author-name" autocomplete="off" />
        </label>

        <label>
          Email
          <input type="text" v-model={draft.email} data-testid="author-email" autocomplete="off" />
        </label>

        <label>
          UUID (auto)
          <input type="text" v-model={draft.id} data-testid="author-id" readonly />
        </label>

        {errors.value.length > 0 ? (
          <ul class="errors" data-testid="author-errors">
            {errors.value.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <button type="submit" data-testid="author-submit">
          Add author
        </button>
      </form>
    )
  },
})
