import { FolderIcon } from '@xomda/icons'

import { registerModule } from '../registry'

registerModule({
  id: 'files',
  routes: [
    {
      path: '/files/:dirPath(.*)*',
      name: 'files',
      component: () =>
        import('./FileBrowserView').then(({ FileBrowserView }) => FileBrowserView),
    },
  ],
  nav: { icon: FolderIcon, label: 'Files', path: '/files', order: 60 },
})
