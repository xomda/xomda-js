import type { Meta, StoryObj } from '@storybook/vue3'
import { h, ref } from 'vue'

import { AuroraBackground } from './AuroraBackground'

const meta: Meta<typeof AuroraBackground> = {
  component: AuroraBackground,
  title: 'UI/Backgrounds/AuroraBackground',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) =>
      h(
        'div',
        {
          style:
            'position:relative;isolation:isolate;width:100%;height:calc(100vh - 24px);overflow:hidden;border-radius:8px;background:transparent;',
        },
        [h(story())]
      ),
  ],
  argTypes: {
    seed: { control: { type: 'number' } },
    mode: { control: { type: 'inline-radio' }, options: ['auto', 'light', 'dark'] },
    intensity: { control: { type: 'range', min: 0, max: 2, step: 0.05 } },
    scale: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    animationSpeed: { control: { type: 'range', min: 0, max: 4, step: 0.1 } },
    blur: { control: { type: 'range', min: 0, max: 20, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
}

export default meta
type Story = StoryObj<typeof AuroraBackground>

export const Playground: Story = {
  args: {
    seed: 0,
    mode: 'auto',
    intensity: 0.4,
    scale: 0.5,
    animationSpeed: 1,
    blur: 0,
    opacity: 1,
  },
  render: (args) => ({
    setup() {
      return () => h(AuroraBackground, args)
    },
  }),
}

export const Dark: Story = {
  args: { seed: 1, mode: 'dark', intensity: 0.4 },
  render: (args) => ({ setup: () => () => h(AuroraBackground, args) }),
}

export const Light: Story = {
  args: { seed: 1, mode: 'light', intensity: 0.4 },
  render: (args) => ({ setup: () => () => h(AuroraBackground, args) }),
}

export const Subtle: Story = {
  args: { seed: 3, mode: 'dark', intensity: 0.35, animationSpeed: 0.5 },
  render: (args) => ({ setup: () => () => h(AuroraBackground, args) }),
}

export const Vivid: Story = {
  args: { seed: 7, mode: 'dark', intensity: 0.9, animationSpeed: 1.5 },
  render: (args) => ({ setup: () => () => h(AuroraBackground, args) }),
}

// Interactive story: click to navigate to a new page / seed
export const PageTransition: Story = {
  args: { mode: 'dark', intensity: 0.7 },
  render: (args) => ({
    setup() {
      const seed = ref(0)
      const page = ref(0)
      const pages = ['Home', 'Gallery', 'About', 'Contact', 'Dashboard']

      function goTo(i: number) {
        page.value = i
        seed.value = i
      }

      return () =>
        h('div', { style: 'position:relative;width:100%;height:100%;' }, [
          h(AuroraBackground, { ...args, seed: seed.value }),
          h(
            'div',
            {
              style:
                'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;',
            },
            [
              h(
                'p',
                {
                  style:
                    'font:600 22px/1.4 system-ui,sans-serif;color:#fff;margin:0 0 8px;text-shadow:0 2px 8px rgba(0,0,0,0.5);',
                },
                pages[page.value]
              ),
              h(
                'div',
                { style: 'display:flex;gap:10px;' },
                pages.map((name, i) =>
                  h(
                    'button',
                    {
                      key: i,
                      onClick: () => goTo(i),
                      style: `padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font:500 14px system-ui,sans-serif;background:${page.value === i ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'};color:#fff;backdrop-filter:blur(8px);transition:background 0.2s;`,
                    },
                    name
                  )
                )
              ),
            ]
          ),
        ])
    },
  }),
}
