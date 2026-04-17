import { registerModule } from '../registry'

/**
 * Settings has its own dedicated button in `AppNav` (bottom rail), so this
 * module contributes the route only — no `nav` entry.
 */
registerModule({
  id: 'settings',
  routes: [
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./SettingsView').then(({ SettingsView }) => SettingsView),
    },
  ],
})
