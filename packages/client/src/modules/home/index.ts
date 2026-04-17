import { HomeIcon } from '@xomda/icons'

import { registerModule } from '../registry'

registerModule({
  id: 'home',
  routes: [
    {
      path: '/',
      component: () => import('./HomeView').then(({ HomeView }) => HomeView),
    },
  ],
  nav: { icon: HomeIcon, label: 'Home', path: '/', order: 10 },
})
