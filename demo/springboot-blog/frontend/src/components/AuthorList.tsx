import { defineComponent, onMounted, ref } from 'vue'

import type { Author } from '../generated/Author'

/**
 * Renders the list of authors returned by `GET /api/authors`. The DTO shape
 * is the xomda-generated `Author` type from `frontend/src/generated/` — the
 * same model.json drives the Spring Boot record on the server side, so the
 * wire format can't drift between halves.
 *
 * `fetchAuthors` is injected via prop so tests can mount the component
 * without a live backend; the prod entry point uses the bundled
 * `defaultFetchAuthors` that hits the proxy.
 */
export const AuthorList = defineComponent({
  name: 'AuthorList',
  props: {
    fetchAuthors: {
      type: Function,
      default: () => defaultFetchAuthors,
    },
  },
  setup(props) {
    const authors = ref<Author[]>([])
    const error = ref<string | null>(null)
    const loading = ref(true)

    onMounted(async () => {
      try {
        authors.value = await (props.fetchAuthors as () => Promise<Author[]>)()
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    })

    return () => (
      <section>
        <h1>Authors</h1>
        {loading.value ? <p data-testid="loading">Loading…</p> : null}
        {error.value ? (
          <p data-testid="error" role="alert">
            {error.value}
          </p>
        ) : null}
        <ul data-testid="author-list">
          {authors.value.map((a) => (
            <li key={a.id} data-testid="author-row">
              <strong>{a.name}</strong> — <span>{a.email}</span>
              {a.bio ? <p>{a.bio}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    )
  },
})

async function defaultFetchAuthors(): Promise<Author[]> {
  const res = await fetch('/api/authors')
  if (!res.ok) throw new Error(`GET /api/authors failed: ${res.status}`)
  return (await res.json()) as Author[]
}
