import { CheckIcon, FilePresentIcon, GenerateIcon } from '@xomda/icons'
import { useDelayedLoading } from '@xomda/ui'
import { defineComponent, ref } from 'vue'
import {
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VIcon,
  VList,
  VListItem,
  VProgressCircular,
} from 'vuetify/components'

import { AppTitleBar } from '../components'
import { useAsyncState } from '../composables'
import { trpc } from '../trpc'

export const GenerateView = defineComponent({
  name: 'GenerateView',
  setup() {
    const results = ref<{ outputPath: string; templateId: string }[]>([])
    const {
      loading: genLoading,
      error: genError,
      execute: genExecute,
    } = useAsyncState<typeof results.value>()
    const showGenLoading = useDelayedLoading(genLoading)

    const generate = () =>
      genExecute(async () => {
        const res = await trpc.template.generate.mutate()
        results.value = res
        return res
      })

    return () => (
      <div class="fill-height d-flex flex-column">
        <AppTitleBar>
          {{
            title: () => 'Template Generation',
            actions: () => (
              <VBtn
                prepend-icon={GenerateIcon}
                variant="tonal"
                color="primary"
                onClick={generate}
                loading={genLoading.value}
              >
                Generate All
              </VBtn>
            ),
          }}
        </AppTitleBar>

        <div class="flex-grow-1 pa-2 pl-0 d-flex flex-column ga-6" style="min-height: 0">
          {genError.value && (
            <VAlert
              type="error"
              closable
              onUpdate:modelValue={(v) => !v && (genError.value = null)}
            >
              {genError.value}
            </VAlert>
          )}

          {results.value.length > 0 && (
            <VCard>
              <VCardTitle>Generated Files ({results.value.length})</VCardTitle>
              <VCardText class={['overflow-auto', 'fill-height']}>
                <VList bgColor={'transparent'}>
                  {results.value.map((res, i) => (
                    <VListItem
                      key={i}
                      prependIcon={FilePresentIcon}
                      title={res.outputPath}
                      subtitle={`Template: ${res.templateId}`}
                    >
                      {{
                        append: () => <VIcon icon={CheckIcon} color="success" />,
                      }}
                    </VListItem>
                  ))}
                </VList>
              </VCardText>
            </VCard>
          )}

          {showGenLoading.value && results.value.length === 0 && (
            <div class="d-flex align-center justify-center fill-height">
              <VProgressCircular indeterminate color="primary" size="64" />
            </div>
          )}

          {!genLoading.value && results.value.length === 0 && !genError.value && (
            <div class="d-flex flex-column align-center justify-center pa-8 text-grey">
              <VIcon icon={GenerateIcon} size="64" class="mb-4" />
              <p>Click "Generate All" to render templates according to your model.</p>
            </div>
          )}
        </div>
      </div>
    )
  },
})
