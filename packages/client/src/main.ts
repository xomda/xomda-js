import '@fontsource-variable/mulish/index.css'
import '@fontsource-variable/source-code-pro/index.css'
import '@xomda/diagram/style.css'

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
