import {
  FolderIcon,
  GenerateIcon,
  HomeIcon,
  ModelIcon,
  TemplatesIcon,
} from '@xomda/icons'
import { computed, defineComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VIcon, VTooltip } from 'vuetify/components'

import styles from './Sidebar.module.scss'

export const Sidebar = defineComponent({
  name: 'Sidebar',
  setup() {
    const router = useRouter()
    const route = useRoute()

    const navItems = [
      { id: 'home', icon: HomeIcon, path: '/', label: 'Home' },
      {
        id: 'model',
        icon: ModelIcon,
        path: '/model',
        label: 'Model',
      },
      {
        id: 'templates',
        icon: TemplatesIcon,
        path: '/templates',
        label: 'Templates',
      },
      {
        id: 'generate',
        icon: GenerateIcon,
        path: '/generate',
        label: 'Template Generation',
      },
      {
        id: 'files',
        icon: FolderIcon,
        path: '/files',
        label: 'Files',
      },
    ]

    const currentPath = computed(() => route.path)

    return () => (
      <div class={styles.navigation}>
        {navItems.map((item) => (
          <VTooltip text={item.label} location="right" key={item.id}>
            {{
              activator: ({ props }: { props: Record<string, unknown> }) => (
                <button
                  {...props}
                  class={[
                    styles.navButton,
                    currentPath.value === item.path /* ||
                    (item.path !== '/' && currentPath.value.startsWith(item.path))
                    */
                      ? styles.navButtonActive
                      : '',
                  ]}
                  onClick={() => router.push(item.path)}
                >
                  <VIcon icon={item.icon} size="24" />
                </button>
              ),
            }}
          </VTooltip>
        ))}
      </div>
    )
  },
})
