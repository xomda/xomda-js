import { FolderIcon, ModelIcon, TemplatesIcon } from '@xomda/icons'
import { defineComponent } from 'vue'
import { useRouter } from 'vue-router'
import { VCard, VCardText, VCol, VContainer, VIcon, VRow } from 'vuetify/components'

import { AppTitleBar } from '../components'
import styles from './HomeView.module.scss'

const sections = [
  {
    route: '/model',
    icon: ModelIcon,
    title: 'Model',
    subtitle: 'Design your Abstract Object Model',
    color: 'rgb(var(--v-theme-primary))',
  },
  {
    route: '/templates',
    icon: TemplatesIcon,
    title: 'Templates',
    subtitle: 'Generate code from your model',
    color: 'rgb(var(--v-theme-success))',
  },
  {
    route: '/files',
    icon: FolderIcon,
    title: 'Files',
    subtitle: 'Browse your project files',
    color: 'rgb(var(--v-theme-info))',
  },
] as const

export const HomeView = defineComponent({
  name: 'HomeView',
  setup() {
    const router = useRouter()
    return () => (
      <div class={styles.main}>
        <AppTitleBar transparent />
        <VContainer fluid class={styles.container}>
          <div class={styles.centered}>
            <h1 class={styles.headline}>xΟΔ</h1>
            <p class={styles.tagline}>xomda.js — Abstract Object Modelling</p>
            <VRow class={styles.sections}>
              {sections.map((section) => (
                <VCol
                  key={section.route}
                  cols={12}
                  sm={4}
                  style={{
                    'flex-grow': 1,
                    'flex-basis': 0,
                  }}
                >
                  <VCard
                    class={[styles.card, 'fill-height']}
                    style={{ '--card-color': section.color }}
                    onClick={() => router.push(section.route)}
                    elevation={0}
                    rounded="xl"
                  >
                    <VCardText class={styles.cardBody}>
                      <VIcon icon={section.icon} size={56} class={styles.icon} />
                      <span class={styles.cardTitle}>{section.title}</span>
                      <span class={styles.cardSubtitle}>{section.subtitle}</span>
                    </VCardText>
                  </VCard>
                </VCol>
              ))}
            </VRow>
          </div>
        </VContainer>
      </div>
    )
  },
})
