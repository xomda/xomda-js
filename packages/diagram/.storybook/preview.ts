import type { Preview } from '@storybook/vue3'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#f0f2f5' },
        { name: 'white', value: '#ffffff' },
        { name: 'dark', value: '#1a1a2e' },
      ],
    },
  },
}

export default preview
