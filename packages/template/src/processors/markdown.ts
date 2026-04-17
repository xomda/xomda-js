import { defineProcessor } from './defineProcessor'

export const markdownProcessor = defineProcessor({
  type: 'markdown',
  execute(_cell, _ctx) {
    // markdown cells are documentation only — no execution
  },
})
