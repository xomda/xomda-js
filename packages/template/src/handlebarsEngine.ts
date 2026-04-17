import Handlebars from 'handlebars'

import { registerHelpers } from './helpers'

let initialised = false

export function getEngine(): typeof Handlebars {
  if (!initialised) {
    registerHelpers(Handlebars)
    initialised = true
  }
  return Handlebars
}

export function compile(templateStr: string): HandlebarsTemplateDelegate {
  return getEngine().compile(templateStr)
}

export function render(templateStr: string, context: Record<string, unknown>): string {
  return compile(templateStr)(context)
}
