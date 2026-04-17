import type { StorybookConfig } from '@storybook/vue3-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  // Hide the "Get started" onboarding checklist in the sidebar — this
  // project is past the setup-from-scratch stage and the widget just
  // takes vertical space.
  features: {
    sidebarOnboardingChecklist: false,
  },
}

export default config
