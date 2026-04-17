import '@fontsource-variable/mulish/index.css'
import '@fontsource-variable/source-code-pro/index.css'
import '@xomda/diagram/style.css'
// Side-effect import: registers every analysis plugin's client manifest
// (icon, preview components) into the @xomda/analysis-client registry.
import '@xomda/analysis-plugins-client'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { App } from './App'
import { router } from './router'
import { vuetify } from './vuetify'

const pinia = createPinia()

const host = document.body.appendChild(document.createElement('div'))

const app = createApp(App) //
  .use(pinia)
  .use(vuetify)
  .use(router)

router.isReady().then(() => {
  app.mount(host)
  document.getElementById('app-loader')?.remove()
})
