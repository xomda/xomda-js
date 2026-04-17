import { defineComponent, Teleport } from 'vue'

import { favicon } from './favicon'

export const AppMeta = defineComponent({
  name: 'AppMeta',

  setup() {
    return () => (
      <Teleport to="head">
        <title>xΟΔ — xomda.js</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Reactive favicon — mutating `favicon.value` updates the tab icon live. */}
        <link rel="icon" type="image/svg+xml" href={favicon.value} />
      </Teleport>
    )
  },
})
