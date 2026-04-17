import { registerModule } from '../registry'
import { SettingsRoutes } from './routes'

/**
 * Settings has its own dedicated button in `AppNav` (bottom rail), so this
 * module contributes the route only — no `nav` entry.
 */
registerModule({
  id: 'settings',
  routes: [
    {
      path: '/settings',
      name: SettingsRoutes.view,
      component: () => import('./SettingsView').then(({ SettingsView }) => SettingsView),
    },
  ],
})

export type { SettingsRouteName } from './routes'
export { SettingsRoutes } from './routes'
