import { createApp } from 'vue'

import { AuthorList } from './components/AuthorList'

createApp({
  render: () => <AuthorList />,
}).mount('#app')
