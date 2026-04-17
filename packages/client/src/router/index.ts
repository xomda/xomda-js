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
      path: '/versions',
      component: () =>
        import('../views/VersionsView').then(({ VersionsView }) => VersionsView),
    },
    {
      path: '/templates/:folderPath(.*)*',
      name: 'templates',
      component: () => import('../views/TemplatesView').then(({ TemplatesView }) => TemplatesView),
    },
    {
      path: '/generate',
      component: () => import('../views/GenerateView').then(({ GenerateView }) => GenerateView),
    },
    {
      path: '/files/:dirPath(.*)*',
      name: 'files',
      component: () =>
        import('../views/FileBrowserView').then(({ FileBrowserView }) => FileBrowserView),
    },
  ],
})
