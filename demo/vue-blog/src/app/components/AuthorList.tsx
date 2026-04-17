import { defineComponent } from 'vue'

import type { Author } from '../types'

export const AuthorList = defineComponent({
  name: 'AuthorList',
  props: {
    authors: { type: Array as () => Author[], required: true },
  },
  setup(props) {
    return () => {
      if (props.authors.length === 0) {
        return (
          <p class="empty" data-testid="author-list-empty">
            No authors yet. Submit the form above to create one.
          </p>
        )
      }
      return (
        <ul class="posts" data-testid="author-list">
          {props.authors.map((a) => (
            <li key={a.id}>
              <h3>{a.name}</h3>
              <div class="meta">
                <span>{a.email}</span>
                {' · '}
                <code>{a.id.slice(0, 8)}</code>
              </div>
            </li>
          ))}
        </ul>
      )
    }
  },
})
