import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

import { ParticleBackground } from './ParticleBackground'
import { presets } from './presets'

const meta: Meta<typeof ParticleBackground> = {
  component: ParticleBackground,
  title: 'UI/Backgrounds/ParticleBackground',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) =>
      h(
        'div',
        {
          style:
            'position:relative;isolation:isolate;width:100%;height:calc(100vh - 24px);overflow:hidden;border-radius:8px;background:var(--v-theme-surface,transparent);',
        },
        [
          h(story()),
          h(
            'div',
            {
              style:
                'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font:600 18px/1.4 system-ui,sans-serif;color:var(--v-theme-on-surface,#888);text-shadow:0 1px 2px rgba(0,0,0,0.2);opacity:0.6;',
            },
            'Move the pointer · click for a drop'
          ),
        ]
      ),
  ],
  argTypes: {
    fieldFunction: {
      control: { type: 'select' },
      options: ['galaxy', 'sphere', 'torus', 'lattice', 'wave', 'noise', 'lorenz'],
    },
    mode: { control: { type: 'inline-radio' }, options: ['auto', 'light', 'dark'] },
    particleCount: { control: { type: 'range', min: 100, max: 12000, step: 100 } },
    particleSize: { control: { type: 'range', min: 20, max: 600, step: 10 } },
    brightness: { control: { type: 'range', min: 0, max: 4, step: 0.05 } },
    glow: { control: { type: 'range', min: 0, max: 4, step: 0.05 } },
    coreIntensity: { control: { type: 'range', min: 0, max: 4, step: 0.05 } },
    brightnessFlicker: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    flickerSpeed: { control: { type: 'range', min: 0, max: 10, step: 0.1 } },
    pointerStrength: { control: { type: 'range', min: 0, max: 5, step: 0.1 } },
    pointerRadius: { control: { type: 'range', min: 0.1, max: 4, step: 0.1 } },
    dropMass: { control: { type: 'range', min: 0, max: 10, step: 0.1 } },
    dropVelocity: { control: { type: 'range', min: 0, max: 10, step: 0.1 } },
    dropRadius: { control: { type: 'range', min: 0.1, max: 5, step: 0.1 } },
    damping: { control: { type: 'range', min: 0.5, max: 1, step: 0.005 } },
    springStrength: { control: { type: 'range', min: 0, max: 4, step: 0.05 } },
    animationSpeed: { control: { type: 'range', min: 0, max: 4, step: 0.1 } },
    blur: { control: { type: 'range', min: 0, max: 20, step: 1 } },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    baseColor: { control: { type: 'color' } },
  },
}

export default meta
type Story = StoryObj<typeof ParticleBackground>

export const Playground: Story = {
  args: {
    ...presets.galaxy,
    mode: 'auto',
    baseColor: '#a8c8ff',
  },
  render: (args) => ({
    setup() {
      return () => h(ParticleBackground, args)
    },
  }),
}

export const Galaxy: Story = {
  args: { ...presets.galaxy },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Nebula: Story = {
  args: { ...presets.nebula },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Lattice: Story = {
  args: { ...presets.lattice },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Pulse: Story = {
  args: { ...presets.pulse },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Vortex: Story = {
  args: { ...presets.vortex },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Rain: Story = {
  args: { ...presets.rain },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Attractor: Story = {
  args: { ...presets.attractor },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const Swell: Story = {
  args: { ...presets.swell },
  render: (args) => ({ setup: () => () => h(ParticleBackground, args) }),
}

export const InnerGalaxy: Story = {
  args: {
    fieldFunction: 'galaxy',

    fieldParams: {
      size: 3,
    },

    particleCount: 7000,
    particleSize: 250,
    springStrength: 0.65,

    camera: {
      position: [-1, 0.4, 0],
      fov: 0.7853981633974483,
      orbitSpeed: 0.09,
    },

    brightnessFlicker: 0.55,
    pointerStrength: 3.5,
    pointerRadius: 1.5,
    mode: 'dark',
    dropVelocity: 4.2,
    dropRadius: 2.2,
    damping: 0.68,
    animationSpeed: 0.4,
    blur: 0,
    opacity: 1,
    dropMass: 0.9,
  },

  render: (args) => ({
    setup: () => () => h(ParticleBackground, args),
  }),
}

export const InsideTheMatrix: Story = {
  args: {
    fieldFunction: 'lattice',

    fieldParams: {
      size: 3,
    },

    particleCount: 4300,
    particleSize: 50,
    springStrength: 1.5,

    camera: {
      position: [2, 1, 0],
      fov: 0.7853981633974483,
      orbitSpeed: 0.04,
    },

    brightnessFlicker: 0.55,
    flickerSpeed: 1.6,
    brightness: 0.85,
    glow: 2.45,
    coreIntensity: 2.45,
    opacity: 0.15,
    blur: 0,
    animationSpeed: 0.3,
    damping: 0.5,
    pointerRadius: 3.1,
    pointerStrength: 3.8,
    mode: 'auto',
    baseColor: '#0542fc',
  },

  render: (args) => ({
    setup: () => () => h(ParticleBackground, args),
  }),
}
