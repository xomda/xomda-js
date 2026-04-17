import { defineComponent, ref } from 'vue'

import { AuthorForm } from './components/AuthorForm'
import { AuthorList } from './components/AuthorList'
import type { Author } from './types'

export const App = defineComponent({
  name: 'App',
  setup() {
    const authors = ref<Author[]>([])

    const handleCreate = (author: Author) => {
      authors.value = [...authors.value, author]
    }

    return () => (
      <main class="app">
        <h1>xomda Vue Blog demo</h1>
        <p class="sub">
          Tiny Vue 3 SPA that validates input against <code>AuthorSchema</code>, a Zod schema xomda
          generates from the Blog domain model. Run <code>pnpm generate</code> in the demo, then{' '}
          <code>pnpm dev</code>, and tweak the model — the form picks up the new shape on
          regenerate.
        </p>

        <h2>New author</h2>
        <AuthorForm onCreate={handleCreate} />

        <h2>Authors</h2>
        <AuthorList authors={authors.value} />
      </main>
    )
  },
})
