import { afterEach, describe, expect, it } from 'vitest'

import {
  getRegisteredTemplateWizards,
  getTemplateWizard,
  registerTemplateWizard,
  resetTemplateWizardRegistry,
} from '../registry'

afterEach(() => resetTemplateWizardRegistry())

describe('templateWizards registry', () => {
  it('round-trips registrations', () => {
    registerTemplateWizard({ id: 'a', label: 'A', create: () => stub('A') })
    registerTemplateWizard({ id: 'b', label: 'B', create: () => stub('B') })
    expect(getRegisteredTemplateWizards().map((w) => w.id)).toEqual(['a', 'b'])
  })

  it('ignores duplicate ids', () => {
    registerTemplateWizard({ id: 'a', label: 'A', create: () => stub('A') })
    registerTemplateWizard({ id: 'a', label: 'A2', create: () => stub('A2') })
    expect(getRegisteredTemplateWizards()).toHaveLength(1)
    expect(getRegisteredTemplateWizards()[0].label).toBe('A')
  })

  it('getTemplateWizard returns undefined for unknown ids', () => {
    expect(getTemplateWizard('missing')).toBeUndefined()
  })

  it('wizard.create receives the folder argument', () => {
    registerTemplateWizard({
      id: 'a',
      label: 'A',
      create: (folder) => ({ ...stub('A'), folder }),
    })
    const t = getTemplateWizard('a')!.create('models/foo')
    expect(t.folder).toBe('models/foo')
  })
})

function stub(name: string) {
  return {
    uuid: '00000000-0000-0000-0000-000000000000',
    name,
    version: '1.0.0',
    cells: [],
  }
}
