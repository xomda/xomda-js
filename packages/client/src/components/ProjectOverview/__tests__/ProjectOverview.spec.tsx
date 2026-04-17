import { mount } from '@vue/test-utils'
import type { OverviewContribution } from '@xomda/analysis-core'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

vi.mock('../../../trpc', () => ({
  trpc: {
    project: {
      overview: { query: vi.fn(async () => ({ contributions: [] })) },
    },
  },
}))

import { ProjectOverview } from '../ProjectOverview'

const vuetify = createVuetify()

const driven = (contributions: OverviewContribution[]) =>
  mount(ProjectOverview, {
    global: { plugins: [vuetify] },
    props: { contributions },
  })

describe('ProjectOverview (driven mode)', () => {
  it('renders an empty hint when contributions is []', () => {
    const w = driven([])
    expect(w.text()).toMatch(/No plugin overview/i)
  })

  it('renders a contribution header with the plugin name', () => {
    const w = driven([
      {
        pluginId: 'maven',
        pluginName: 'Apache Maven',
        sections: [{ id: 'identity', kind: 'key-value', title: 'POM', rows: [] }],
      },
    ])
    expect(w.text()).toContain('Apache Maven')
    expect(w.text()).toContain('POM')
  })

  it('renders key-value rows', () => {
    const w = driven([
      {
        pluginId: 'maven',
        pluginName: 'Maven',
        sections: [
          {
            id: 's',
            kind: 'key-value',
            title: 'POM',
            rows: [
              { key: 'groupId', value: 'org.example' },
              { key: 'artifactId', value: 'demo' },
            ],
          },
        ],
      },
    ])
    expect(w.text()).toContain('groupId')
    expect(w.text()).toContain('org.example')
    expect(w.text()).toContain('artifactId')
    expect(w.text()).toContain('demo')
  })

  it('renders table headers + cells', () => {
    const w = driven([
      {
        pluginId: 'maven',
        pluginName: 'Maven',
        sections: [
          {
            id: 'deps',
            kind: 'table',
            title: 'Dependencies',
            columns: ['Group', 'Artifact', 'Version'],
            rows: [['org.springframework', 'spring-core', '6.1.0']],
          },
        ],
      },
    ])
    expect(w.text()).toContain('Group')
    expect(w.text()).toContain('Artifact')
    expect(w.text()).toContain('Version')
    expect(w.text()).toContain('spring-core')
    expect(w.text()).toContain('6.1.0')
  })

  it('renders list items', () => {
    const w = driven([
      {
        pluginId: 'node',
        pluginName: 'Node.js',
        sections: [
          {
            id: 'ws',
            kind: 'list',
            title: 'Workspaces',
            items: [{ label: 'packages/core' }, { label: 'packages/ui', sub: 'UI library' }],
          },
        ],
      },
    ])
    expect(w.text()).toContain('packages/core')
    expect(w.text()).toContain('packages/ui')
    expect(w.text()).toContain('UI library')
  })

  it('renders status label and sub', () => {
    const w = driven([
      {
        pluginId: 'node',
        pluginName: 'Node',
        sections: [
          {
            id: 'pm',
            kind: 'status',
            title: 'Package manager',
            tone: 'info',
            label: 'pnpm 10.x',
            sub: 'Detected via pnpm-lock.yaml',
          },
        ],
      },
    ])
    expect(w.text()).toContain('pnpm 10.x')
    expect(w.text()).toContain('Detected via pnpm-lock.yaml')
  })

  it('shows a fallback hint when a custom componentId is not registered', () => {
    const w = driven([
      {
        pluginId: 'unknown',
        pluginName: 'Unknown',
        sections: [
          {
            id: 'c',
            kind: 'custom',
            title: 'Custom',
            componentId: 'nope',
          },
        ],
      },
    ])
    expect(w.text()).toMatch(/No component registered/i)
  })
})
