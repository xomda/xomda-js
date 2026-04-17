import { HistoryIcon } from '@xomda/icons'

import { registerModule } from '../registry'

registerModule({
  id: 'versions',
  routes: [
    {
      path: '/versions',
      component: () => import('./VersionsView').then(({ VersionsView }) => VersionsView),
    },
  ],
  nav: { icon: HistoryIcon, label: 'Versions', path: '/versions', order: 30 },
})
