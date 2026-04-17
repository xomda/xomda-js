import type { ModelDiff, Version } from '@xomda/core'
import { HistoryIcon, SaveIcon } from '@xomda/icons'
import { useDelayedLoading } from '@xomda/ui'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VIcon,
  VList,
  VListItem,
  VProgressCircular,
  VSelect,
} from 'vuetify/components'

import { AppTitleBar, CommitModal, ModelDiffView, PanelDivider } from '../../components'
import { useAsyncState, usePanelResize } from '../../composables'
import { trpc } from '../../trpc'

const CURRENT_OPTION = '__current__'

export const VersionsView = defineComponent({
  name: 'VersionsView',
  setup() {
    const versions = ref<Version[]>([])
    const selectedId = ref<string | null>(null)
    const compareBeforeId = ref<string | null>(null)
    const compareAfterId = ref<string>(CURRENT_OPTION)
    const diff = ref<ModelDiff | null>(null)
    const commitOpen = ref(false)

    const { loading: listLoading, error: listError, execute: listExecute } = useAsyncState()
    const {
      loading: diffLoading,
      error: diffError,
      execute: diffExecute,
    } = useAsyncState<ModelDiff>()
    const showListLoading = useDelayedLoading(listLoading)

    const loadVersions = (): void => {
      listExecute(async () => {
        versions.value = await trpc.model.listVersions.query()
        if (!selectedId.value && versions.value[0]) selectedId.value = versions.value[0].id
        if (!compareBeforeId.value && versions.value[0])
          compareBeforeId.value = versions.value[0].id
      })
    }

    const computeDiff = (): void => {
      if (!compareBeforeId.value) return
      diffExecute(async () => {
        const result =
          compareAfterId.value === CURRENT_OPTION
            ? await trpc.model.diffWithCurrent.query({ versionId: compareBeforeId.value! })
            : await trpc.model.diffVersions.query({
                beforeId: compareBeforeId.value!,
                afterId: compareAfterId.value,
              })
        diff.value = result as ModelDiff
        return result as ModelDiff
      })
    }

    onMounted(loadVersions)

    const route = useRoute()
    const router = useRouter()
    watch(
      [() => route.query.select, versions],
      ([selectId]) => {
        const id = typeof selectId === 'string' ? selectId : ''
        if (!id) return
        const found = versions.value.find((v) => v.id === id)
        if (found) {
          selectedId.value = found.id
          compareBeforeId.value = found.id
          void router.replace({ path: '/versions', query: {} })
        }
      },
      { immediate: true }
    )

    const onCommitted = (): void => {
      loadVersions()
    }

    const afterOptions = computed(() => [
      { value: CURRENT_OPTION, title: 'Current (working model)' },
      ...versions.value.map((v) => ({ value: v.id, title: v.label })),
    ])

    const beforeOptions = computed(() =>
      versions.value.map((v) => ({ value: v.id, title: v.label }))
    )

    const { width: leftWidth, onResize } = usePanelResize(320, 220, 600)

    return () => (
      <div class="d-flex flex-column h-100">
        <AppTitleBar>
          {{
            title: () => 'Versions',
            actions: () => (
              <VBtn
                prepend-icon={SaveIcon}
                variant="tonal"
                color="primary"
                onClick={() => (commitOpen.value = true)}
              >
                Publish version
              </VBtn>
            ),
          }}
        </AppTitleBar>

        <CommitModal v-model={commitOpen.value} onCommitted={onCommitted} />

        <div class="d-flex flex-grow-1 overflow-hidden">
          <div style={{ width: `${leftWidth.value}px`, overflow: 'auto' }} class="border-r-sm">
            {listError.value && (
              <VAlert type="error" density="compact" class="ma-2">
                {listError.value}
              </VAlert>
            )}
            {showListLoading.value && versions.value.length === 0 ? (
              <div class="d-flex justify-center pa-4">
                <VProgressCircular indeterminate size="24" />
              </div>
            ) : versions.value.length === 0 ? (
              <div class="text-grey text-body-2 pa-4">
                <VIcon icon={HistoryIcon} class="mr-1" />
                No versions yet. Click "Publish version" to create the first one.
              </div>
            ) : (
              <VList density="compact" lines="two">
                {versions.value.map((v) => (
                  <VListItem
                    key={v.id}
                    active={selectedId.value === v.id}
                    title={v.label}
                    subtitle={new Date(v.timestamp).toLocaleString()}
                    onClick={() => (selectedId.value = v.id)}
                    prependIcon={HistoryIcon}
                  >
                    {v.message ? <div class="text-caption text-grey">{v.message}</div> : null}
                  </VListItem>
                ))}
              </VList>
            )}
          </div>

          <PanelDivider onResize={onResize} />

          <div class="flex-grow-1 overflow-auto pa-2">
            <VCard flat>
              <VCardText>
                <h3 class="text-subtitle-1 mb-2">Compare</h3>
                <div class="d-flex ga-2 align-center mb-3">
                  <VSelect
                    v-model={compareBeforeId.value}
                    items={beforeOptions.value}
                    label="Before"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="max-width: 280px"
                  />
                  <span>→</span>
                  <VSelect
                    v-model={compareAfterId.value}
                    items={afterOptions.value}
                    label="After"
                    density="compact"
                    variant="outlined"
                    hide-details
                    style="max-width: 280px"
                  />
                  <VBtn
                    color="primary"
                    variant="tonal"
                    onClick={computeDiff}
                    loading={diffLoading.value}
                    disabled={!compareBeforeId.value}
                  >
                    Compare
                  </VBtn>
                </div>
                {diffError.value && (
                  <VAlert type="error" density="compact" class="mb-2">
                    {diffError.value}
                  </VAlert>
                )}
                {diff.value ? (
                  <ModelDiffView diff={diff.value} />
                ) : (
                  <p class="text-body-2 text-grey">
                    Pick a before/after version and press Compare.
                  </p>
                )}
              </VCardText>
            </VCard>
          </div>
        </div>
      </div>
    )
  },
})
