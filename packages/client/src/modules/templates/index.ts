import { TemplatesIcon } from '@xomda/icons'

import { registerModule } from '../registry'

registerModule({
  id: 'templates',
  routes: [
    {
      path: '/templates/:folderPath(.*)*',
      name: 'templates',
      component: () => import('./TemplatesView').then(({ TemplatesView }) => TemplatesView),
    },
  ],
  nav: { icon: TemplatesIcon, label: 'Templates', path: '/templates', order: 40 },
})
