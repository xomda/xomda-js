import { join } from 'node:path'

import { TEMPLATES_DIR, XOMDA_DIR } from '@xomda/core'

export { TEMPLATES_DIR, XOMDA_DIR }

export function getTemplatesDir(root = process.cwd()): string {
  return join(root, XOMDA_DIR, TEMPLATES_DIR)
}
