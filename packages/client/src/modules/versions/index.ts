import { HistoryIcon } from '@xomda/icons'

import { registerModule } from '../registry'
import { VersionsRoutes } from './routes'

registerModule({
  id: 'versions',
  routes: [
    {
      path: '/versions',
      name: VersionsRoutes.view,
      component: () => import('./VersionsView').then(({ VersionsView }) => VersionsView),
    },
  ],
  nav: { icon: HistoryIcon, label: 'Versions', routeName: VersionsRoutes.view, order: 30 },
})

export type { VersionsRouteName } from './routes'
export { VersionsRoutes } from './routes'
