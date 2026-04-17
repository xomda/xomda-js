import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import vuetify from 'vite-plugin-vuetify'

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
  // `vite-plugin-vuetify` injects the package's `settings.scss` ahead of
  // `vuetify/styles`, so the CSS Storybook serves uses the same variable
  // overrides (border radius, field height, switch dimensions, …) the
  // client compiles for production. Without this, stories render with
  // stock Vuetify dimensions and look nothing like the real app.
  viteFinal: (cfg) =>
    mergeConfig(cfg, {
      plugins: [
        vuetify({
          autoImport: false,
          styles: { configFile: 'src/styles/settings.scss' },
        }),
      ],
    }),
}

export default config
