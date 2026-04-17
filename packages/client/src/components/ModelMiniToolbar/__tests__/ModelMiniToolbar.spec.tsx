import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { ModelMiniToolbar, type ToolbarSelection } from '../ModelMiniToolbar'

const vuetify = createVuetify()

const mountToolbar = (props: Record<string, unknown> = {}) =>
  mount(ModelMiniToolbar, {
    props,
    global: { plugins: [createPinia(), vuetify] },
  })

const entitySel: ToolbarSelection = {
  kind: 'entity',
  entity: { id: 'e1', name: 'User', attributes: [] } as unknown as ToolbarSelection extends {
    kind: 'entity'
    entity: infer E
  }
    ? E
    : never,
  packageId: 'p1',
}
const enumSel: ToolbarSelection = {
  kind: 'enum',
  enum: { id: 'n1', name: 'Status', values: [] } as unknown as ToolbarSelection extends {
    kind: 'enum'
    enum: infer E
  }
    ? E
    : never,
  packageId: 'p1',
}
const pkgSel: ToolbarSelection = {
  kind: 'package',
  package: {
    id: 'p1',
    name: 'pkg',
    entities: [],
    enums: [],
    packages: [],
  } as unknown as ToolbarSelection extends { kind: 'package'; package: infer P } ? P : never,
}

describe('ModelMiniToolbar', () => {
  it('renders nothing when nothing is selected', () => {
    const w = mountToolbar({ selection: null })
    expect(w.find('[role="toolbar"]').exists()).toBe(false)
  })

  it('does not render layout Save/Cancel — those live in LayoutSavePill', () => {
    const w = mountToolbar({ selection: entitySel })
    expect(w.find('[aria-label="Save layout"]').exists()).toBe(false)
    expect(w.find('[aria-label="Cancel layout changes"]').exists()).toBe(false)
  })

  it('entity selection shows the Add attribute button (not Add value/entity/enum)', () => {
    const w = mountToolbar({ selection: entitySel })
    expect(w.find('[aria-label="Add attribute"]').exists()).toBe(true)
    expect(w.find('[aria-label="Add enum value"]').exists()).toBe(false)
    expect(w.find('[aria-label="Add entity"]').exists()).toBe(false)
  })

  it('enum selection shows the Add value button', () => {
    const w = mountToolbar({ selection: enumSel })
    expect(w.find('[aria-label="Add enum value"]').exists()).toBe(true)
    expect(w.find('[aria-label="Add attribute"]').exists()).toBe(false)
  })

  it('package selection shows Add entity, enum, and nested package', () => {
    const w = mountToolbar({ selection: pkgSel })
    expect(w.find('[aria-label="Add entity"]').exists()).toBe(true)
    expect(w.find('[aria-label="Add enum"]').exists()).toBe(true)
    expect(w.find('[aria-label="Add nested package"]').exists()).toBe(true)
  })

  it('Move-to-package and Drag-scene shortcut appear for any selection', () => {
    const w = mountToolbar({ selection: entitySel })
    expect(w.find('[aria-label="Move to package"]').exists()).toBe(true)
    expect(w.find('[aria-label="Drag scene"]').exists()).toBe(true)
  })

  it('does not render the Reset zero point button — that lives in SceneMiniToolbar', () => {
    const w = mountToolbar({ selection: entitySel })
    expect(w.find('[aria-label="Reset zero point"]').exists()).toBe(false)
  })

  it('Drag-scene button fires onSwitchToPanMode', async () => {
    const onSwitchToPanMode = vi.fn()
    const w = mountToolbar({ selection: entitySel, onSwitchToPanMode })
    await w.find('[aria-label="Drag scene"]').trigger('click')
    expect(onSwitchToPanMode).toHaveBeenCalledTimes(1)
  })

  it('clicking the entity Add attribute button invokes the handler', async () => {
    const onAddAttribute = vi.fn()
    const w = mountToolbar({ selection: entitySel, onAddAttribute })
    await w.find('[aria-label="Add attribute"]').trigger('click')
    expect(onAddAttribute).toHaveBeenCalledTimes(1)
  })

  it('applies the anchor as inline top/left when provided', () => {
    const w = mountToolbar({
      selection: entitySel,
      anchor: { top: 120, left: 240 },
    })
    const toolbar = w.find('[role="toolbar"]')
    const style = toolbar.attributes('style') ?? ''
    expect(style).toContain('top: 120px')
    expect(style).toContain('left: 240px')
  })

  it('renders the Close button when onClose is provided and fires the handler', async () => {
    const onClose = vi.fn()
    const w = mountToolbar({ selection: entitySel, onClose })
    const btn = w.find('[aria-label="Close toolbar"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render the Close button when no onClose handler is wired', () => {
    const w = mountToolbar({ selection: entitySel })
    expect(w.find('[aria-label="Close toolbar"]').exists()).toBe(false)
  })
})
