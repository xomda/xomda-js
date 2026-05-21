import { FolderIcon } from '@xomda/icons'

import { registerModule } from '../registry'
import { FilesRoutes } from './routes'

registerModule({
  id: 'files',
  routes: [
    {
      path: '/files/:dirPath(.*)*',
      name: FilesRoutes.browse,
      component: () => import('./FileBrowserView').then(({ FileBrowserView }) => FileBrowserView),
    },
  ],
  nav: { icon: FolderIcon, label: 'Files', routeName: FilesRoutes.browse, order: 60 },
})

export type { FilesRouteName } from './routes'
export { FilesRoutes } from './routes'
