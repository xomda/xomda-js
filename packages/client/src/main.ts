import '@fontsource-variable/mulish/index.css'
import '@fontsource-variable/source-code-pro/index.css'
import '@xomda/diagram/style.css'
// Side-effect import: registers every analysis plugin's client manifest
// (icon, preview components) into the @xomda/analysis-client registry.
import '@xomda/analysis-plugins-client'
// Side-effect import: registers every built-in app module (routes, nav,
// stores) into the module registry. Must happen *before* `./router` is
// imported — the router collects routes from the registry on construction.
import './modules/registerAll'
// Side-effect import: registers every built-in template wizard
// (blank + per-stack wizards) into the template-wizard registry.
import './templateWizards/registerAll'

import { createPinia } from 'pinia'
import { setActivePinia } from 'pinia'
import { createApp } from 'vue'

import { App } from './App'
import { initializeModules } from './modules'
import { router } from './router'
import { vuetify } from './vuetify'

const pinia = createPinia()
// Pinia normally activates on `app.use(pinia)`. We activate early so
// module `setup()` hooks can define Pinia stores before mount.
setActivePinia(pinia)
initializeModules()

const host = document.body.appendChild(document.createElement('div'))

const app = createApp(App) //
  .use(pinia)
  .use(vuetify)
  .use(router)

router.isReady().then(() => {
  app.mount(host)
  document.getElementById('app-loader')?.remove()
})
