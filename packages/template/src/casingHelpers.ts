import { camelCase, constantCase, kebabCase, pascalCase, snakeCase } from 'change-case'

/**
 * Canonical string-casing helpers shared by the Handlebars helper registry
 * and the logic-cell sandbox. Defining them once keeps the two surfaces in
 * sync — adding a casing here exposes it in both.
 */
export const casingHelpers = {
  pascalCase: (s: string) => pascalCase(s ?? ''),
  camelCase: (s: string) => camelCase(s ?? ''),
  snakeCase: (s: string) => snakeCase(s ?? ''),
  kebabCase: (s: string) => kebabCase(s ?? ''),
  constantCase: (s: string) => constantCase(s ?? ''),
  upperCase: (s: string) => (s ?? '').toUpperCase(),
  lowerCase: (s: string) => (s ?? '').toLowerCase(),
} as const

export type CasingHelpers = typeof casingHelpers
