import type { ModelDiff, Version as ModelVersion } from '@xomda/core'
import { HistoryIcon, SaveIcon } from '@xomda/icons'
import { useDelayedLoading, Version } from '@xomda/ui'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VEmptyState,
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
    const versions = ref<ModelVersion[]>([])
    const currentVersion = ref('')
    const selectedId = ref<string | null>(null)
    const compareBeforeId = ref<string | null>(null)
    const compareAfterId = ref<string>(CURRENT_OPTION)
    const diff = ref<ModelDiff | null>(null)
    const commitOpen = ref(false)

    const { loading: listLoading, error: listError, run: listRun } = useAsyncState()
    const { loading: diffLoading, error: diffError, run: diffRun } = useAsyncState<ModelDiff>()
    const showListLoading = useDelayedLoading(listLoading)

    const loadVersions = (): void => {
      listRun(async () => {
        const [list, model] = await Promise.all([
          trpc.model.listVersions.query(),
          trpc.model.get.query(),
        ])
        versions.value = list
        currentVersion.value = model?.version ?? ''
        if (!selectedId.value && versions.value[0]) selectedId.value = versions.value[0].id
        if (!compareBeforeId.value && versions.value[0])
          compareBeforeId.value = versions.value[0].id
      })
    }

    const computeDiff = (): void => {
      if (!compareBeforeId.value) return
      diffRun(async () => {
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

    const hasVersions = computed(() => versions.value.length > 0)
    const showEmptyState = computed(
      () => !showListLoading.value && !hasVersions.value && !listError.value
    )

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
                Publish
              </VBtn>
            ),
          }}
        </AppTitleBar>

        <CommitModal
          v-model={commitOpen.value}
          currentVersion={currentVersion.value}
          knownVersionLabels={versions.value.map((v) => v.label)}
          onCommitted={onCommitted}
        />

        {showEmptyState.value ? (
          <div class="flex-grow-1 overflow-auto d-flex justify-center">
            <VEmptyState
              icon={HistoryIcon}
              title="Publish your first version"
              text="Publish a snapshot of the current model to start tracking history. Once you have two or more versions, you can compare them side by side here."
              class="pt-12"
              style="min-height: 0; max-width: 480px"
            >
              {{
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
            </VEmptyState>
          </div>
        ) : (
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
              ) : (
                <VList density="compact" lines="two">
                  {versions.value.map((v) => (
                    <VListItem
                      key={v.id}
                      active={selectedId.value === v.id}
                      subtitle={new Date(v.timestamp).toLocaleString()}
                      onClick={() => (selectedId.value = v.id)}
                      prependIcon={HistoryIcon}
                    >
                      {{
                        title: () => <Version version={v.label} prefix="v" />,
                        default: () =>
                          v.message ? <div class="text-caption text-grey">{v.message}</div> : null,
                      }}
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
                    <VEmptyState
                      icon={HistoryIcon}
                      title="Nothing to compare yet"
                      text="Pick a before/after version and press Compare."
                    />
                  )}
                </VCardText>
              </VCard>
            </div>
          </div>
        )}
      </div>
    )
  },
})
