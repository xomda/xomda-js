/** Root folder for all xomda project data. Can be overridden via XOMDA_DIR env var. */
export const XOMDA_DIR =
  (typeof process !== 'undefined' ? process.env?.XOMDA_DIR : undefined) ?? '.xomda'

export const MODEL_FILE = 'model.json'
export const TEMPLATES_DIR = 'templates'

export * from './diff/index'
export * from './dynamic/index'
export * from './inheritance/index'
export * from './introspect/index'
export * from './schemas/index'
export * from './storage/index'
export * from './testing/index'
