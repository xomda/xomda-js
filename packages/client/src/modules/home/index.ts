import { HomeIcon } from '@xomda/icons'

import { registerModule } from '../registry'
import { HomeRoutes } from './routes'

registerModule({
  id: 'home',
  routes: [
    {
      path: '/',
      name: HomeRoutes.view,
      component: () => import('./HomeView').then(({ HomeView }) => HomeView),
    },
  ],
  nav: { icon: HomeIcon, label: 'Home', routeName: HomeRoutes.view, order: 10 },
})

export type { HomeRouteName } from './routes'
export { HomeRoutes } from './routes'
