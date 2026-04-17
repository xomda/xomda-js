import { TemplatesIcon } from '@xomda/icons'

import { registerModule } from '../registry'
import { TemplatesRoutes } from './routes'

registerModule({
  id: 'templates',
  routes: [
    {
      path: '/templates/:folderPath(.*)*',
      name: TemplatesRoutes.view,
      component: () => import('./TemplatesView').then(({ TemplatesView }) => TemplatesView),
    },
  ],
  nav: { icon: TemplatesIcon, label: 'Templates', routeName: TemplatesRoutes.view, order: 40 },
})

export type { TemplatesRouteName } from './routes'
export { TemplatesRoutes } from './routes'
