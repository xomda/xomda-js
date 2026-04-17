import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { VBtn } from 'vuetify/components'

import { useConfirm } from '../../composables/useConfirm'
import { ConfirmDialog } from './ConfirmDialog'
import { ConfirmDialogHost } from './ConfirmDialogHost'

const meta: Meta<typeof ConfirmDialog> = {
  component: ConfirmDialog,
  title: 'UI/ConfirmDialog',
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const Default: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <ConfirmDialog
          modelValue={open.value}
          title="Delete entity"
          message='Are you sure you want to delete "Customer"? This action cannot be undone.'
          confirmLabel="Delete"
          confirmColor="error"
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const Loading: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <ConfirmDialog
          modelValue={open.value}
          title="Publishing version"
          message="Saving the current model state as v1.0..."
          confirmLabel="Publish"
          loading
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
        />
      )
    },
  }),
}

export const ViaUseConfirm: Story = {
  name: 'Via useConfirm composable',
  render: () => ({
    setup() {
      const { confirm } = useConfirm()
      const lastResult = ref<string>('')
      const trigger = async (): Promise<void> => {
        const ok = await confirm({
          title: 'Delete attribute',
          message: 'Remove "email" from the User entity?',
          confirmLabel: 'Delete',
          confirmColor: 'error',
        })
        lastResult.value = ok ? 'confirmed' : 'cancelled'
      }
      return () => (
        <div>
          <VBtn color="primary" onClick={trigger}>
            Trigger confirm
          </VBtn>
          <p class="mt-3 text-body-2 text-disabled">Last result: {lastResult.value || '—'}</p>
          <ConfirmDialogHost />
        </div>
      )
    },
  }),
}
