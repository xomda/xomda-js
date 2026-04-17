import type { TemplateCell } from '@xomda/core'

import type { CellContext, CellProcessor } from './types'

export function defineProcessor<C extends TemplateCell = TemplateCell>(
  processor: CellProcessor<C>
): CellProcessor<C> {
  return processor
}

export type { CellContext, CellProcessor }
