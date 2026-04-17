import 'vuetify/styles'

import { mount } from 'cypress/vue'
import { createVuetify } from 'vuetify'
import Chainable = Cypress.Chainable
import CommandFn = Cypress.CommandFn

const vuetify = createVuetify()

type MountKeys = keyof typeof mount

Cypress.Commands.add(
  'mount' as keyof Chainable<MountKeys>,
  ((component: Parameters<typeof mount>[0], options: Parameters<typeof mount>[1] = {}) => {
    options.global = options.global ?? {}
    options.global.plugins = [...(options.global.plugins ?? []), vuetify]
    return mount(component, options)
  }) as CommandFn<MountKeys>
)
