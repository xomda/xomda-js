import { GenerateIcon } from '@xomda/icons'

import { registerModule } from '../registry'

registerModule({
  id: 'generate',
  routes: [
    {
      path: '/generate',
      component: () => import('./GenerateView').then(({ GenerateView }) => GenerateView),
    },
  ],
  nav: { icon: GenerateIcon, label: 'Template Generation', path: '/generate', order: 50 },
})
