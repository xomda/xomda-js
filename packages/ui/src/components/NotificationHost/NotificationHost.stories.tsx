import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia } from 'pinia'
import { onMounted } from 'vue'
import { VBtn } from 'vuetify/components'

import { useNotificationsStore } from '../../stores/notifications'
import { NotificationHost } from './NotificationHost'

const pinia = createPinia()

const meta: Meta<typeof NotificationHost> = {
  component: NotificationHost,
  title: 'UI/NotificationHost',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) => ({
      components: { story },
      setup: () => ({ pinia }),
      template: `<div><story /></div>`,
    }),
  ],
}

export default meta
type Story = StoryObj<typeof NotificationHost>

export const Default: Story = {
  render: () => ({
    setup() {
      const store = useNotificationsStore(pinia)
      const trigger = (kind: 'info' | 'success' | 'warning' | 'error') => {
        store[kind](`${kind}: a sample notification.`)
      }
      onMounted(() => store.info('Welcome — notifications dock in the bottom-right.'))
      return () => (
        <div style={{ padding: '24px' }}>
          <div class="d-flex ga-2">
            <VBtn onClick={() => trigger('info')}>Info</VBtn>
            <VBtn onClick={() => trigger('success')} color="success">
              Success
            </VBtn>
            <VBtn onClick={() => trigger('warning')} color="warning">
              Warning
            </VBtn>
            <VBtn onClick={() => trigger('error')} color="error">
              Error
            </VBtn>
          </div>
          <NotificationHost />
        </div>
      )
    },
  }),
}

export const PreFilled: Story = {
  render: () => ({
    setup() {
      const store = useNotificationsStore(pinia)
      onMounted(() => {
        store.info('Heads up — info notification.')
        store.success('Saved successfully.')
        store.warning('Heads up — careful with this one.')
        store.error('Failed to save the model.')
      })
      return () => <NotificationHost />
    },
  }),
}
