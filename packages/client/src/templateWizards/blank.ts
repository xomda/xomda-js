import { DraftIcon } from '@xomda/icons'

import { registerTemplateWizard } from './registry'

/**
 * The default wizard — produces an empty template, matching the legacy
 * `newTemplate()` behaviour. Always available; serves as the fallback
 * when no stack-specific wizard fits.
 */
registerTemplateWizard({
  id: 'blank',
  label: 'Blank template',
  description: 'Empty template — author cells from scratch.',
  icon: DraftIcon,
  create: (folder?: string) => ({
    uuid: crypto.randomUUID(),
    name: 'New Template',
    version: '1.0.0',
    cells: [],
    ...(folder ? { folder } : {}),
  }),
})
