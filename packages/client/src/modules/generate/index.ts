import { GenerateIcon } from '@xomda/icons'

import { registerModule } from '../registry'
import { GenerateRoutes } from './routes'

registerModule({
  id: 'generate',
  routes: [
    {
      path: '/generate',
      name: GenerateRoutes.view,
      component: () => import('./GenerateView').then(({ GenerateView }) => GenerateView),
    },
  ],
  nav: {
    icon: GenerateIcon,
    label: 'Template Generation',
    routeName: GenerateRoutes.view,
    order: 50,
  },
})

export type { GenerateRouteName } from './routes'
export { GenerateRoutes } from './routes'
