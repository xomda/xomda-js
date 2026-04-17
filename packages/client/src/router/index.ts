import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/HomeView').then(({ HomeView }) => HomeView),
    },
    {
      path: '/model',
      component: () => import('../views/ModelView').then(({ ModelView }) => ModelView),
    },
    {
      path: '/templates',
      component: () => import('../views/TemplatesView').then(({ TemplatesView }) => TemplatesView),
    },
    {
      path: '/templates-pp',
      component: () =>
        import('../views/TemplatePPView').then(({ TemplatePPView }) => TemplatePPView),
    },
    {
      path: '/generate',
      component: () => import('../views/GenerateView').then(({ GenerateView }) => GenerateView),
    },
    {
      path: '/files',
      component: () =>
        import('../views/FileBrowserView').then(({ FileBrowserView }) => FileBrowserView),
    },
  ],
})
