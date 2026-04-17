import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { VBtn } from 'vuetify/components'

import { FilePreviewDialog } from './FilePreviewDialog'

const meta: Meta<typeof FilePreviewDialog> = {
  component: FilePreviewDialog,
  title: 'UI/FilePreviewDialog',
}

export default meta
type Story = StoryObj<typeof FilePreviewDialog>

const sampleTs = `import { computed } from 'vue'

export function useExample() {
  const greeting = computed(() => 'hello, xomda')
  return { greeting }
}
`

const sampleJson = `{
  "id": "m1",
  "name": "Demo",
  "version": "1.0.0",
  "packages": [
    { "id": "p1", "name": "core", "entities": [], "enums": [], "packages": [] }
  ]
}`

export const Default: Story = {
  render: () => ({
    setup() {
      const open = ref(false)
      return () => (
        <>
          <VBtn onClick={() => (open.value = true)}>Open preview</VBtn>
          <FilePreviewDialog
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => (open.value = v)}
            title="example.ts"
            content={sampleTs}
            language="typescript"
          />
        </>
      )
    },
  }),
}

export const JsonContent: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <FilePreviewDialog
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
          title=".xomda/model.json"
          content={sampleJson}
          language="json"
        />
      )
    },
  }),
}

export const PlainText: Story = {
  render: () => ({
    setup() {
      const open = ref(true)
      return () => (
        <FilePreviewDialog
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => (open.value = v)}
          title="README.txt"
          content="A plain-text preview — useful when the file has no associated language."
        />
      )
    },
  }),
}
