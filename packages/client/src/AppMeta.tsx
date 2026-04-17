import { defineComponent, Teleport } from 'vue'

export const AppMeta = defineComponent({
  name: 'AppMeta',

  setup() {
    return () => (
      <Teleport to="head">
        <title>xΟΔ — xomda.js</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Teleport>
    )
  },
})
